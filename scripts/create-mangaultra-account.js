// One-off setup script — run once per environment (`node scripts/create-mangaultra-account.js`
// from the project root, with .env.local populated).
//
// lib/util.js's maskAdminIdentity replaces every admin's real identity with
// @MangaUltra wherever it's shown to someone else (comments, review
// threads, notifications) — a real profiles row, not a synthetic name, so
// /u/MangaUltra is always a genuine, linkable profile instead of a 404.
// This script creates that account: a real Supabase Auth user (required —
// profiles.id is a foreign key into auth.users) plus its profiles row, with
// a random password nobody needs (nothing ever logs into this account; it
// exists purely as a display identity). Safe to re-run — it's a no-op if
// the profile already exists.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const projectDir = path.join(__dirname, '..');
const envContent = fs.readFileSync(path.join(projectDir, '.env.local'), 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const USERNAME = 'MangaUltra';
const EMAIL = 'team@mangaultra.example.com';
const BIO = 'The official MangaUltra account — used for platform-wide actions and moderation notices.';

// Same icon lib/util.js's ADMIN_AVATAR_URL renders everywhere the identity
// is masked — set here too so the real profile page matches.
const MU_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="32" fill="#111827"/>' +
  '<text x="32" y="41" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="22" ' +
  'font-weight="700" fill="#ffffff" text-anchor="middle">MU</text></svg>';
const AVATAR_URL = `data:image/svg+xml,${encodeURIComponent(MU_ICON_SVG)}`;

const supabaseAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const pool = new Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  try {
    const { rows: existing } = await pool.query('SELECT id FROM profiles WHERE username = $1', [USERNAME]);
    if (existing.length > 0) {
      console.log('Profile already exists:', existing[0].id);
      return;
    }

    const password = crypto.randomBytes(24).toString('base64');
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: { system_account: true },
    });
    if (error) throw error;
    const userId = data.user.id;
    console.log('Created auth user:', userId);

    await pool.query(
      `INSERT INTO profiles (id, username, email, role, bio, avatar_url) VALUES ($1, $2, $3, 'creator', $4, $5)`,
      [userId, USERNAME, EMAIL, BIO, AVATAR_URL]
    );
    console.log('Created profile row for', USERNAME);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
