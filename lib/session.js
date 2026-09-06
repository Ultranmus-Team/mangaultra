import { createClient } from './supabaseServer.js';
import { query } from './db.js';
import { ensureProfile } from './profile.js';

export async function getCurrentProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { rows } = await query(
    'SELECT id, username, role, is_banned, bio, avatar_url FROM profiles WHERE id = $1',
    [user.id]
  );
  if (rows.length > 0) {
    return { ...rows[0], email: user.email };
  }

  if (user.email_confirmed_at) {
    // A confirmed auth user with no profile row means the profile-creation
    // step (in /auth/confirm or /auth/callback) never completed for them —
    // self-heal by creating it now instead of leaving them permanently
    // unable to log in.
    await ensureProfile(user);
    const { rows: created } = await query(
      'SELECT id, username, role, is_banned, bio, avatar_url FROM profiles WHERE id = $1',
      [user.id]
    );
    return created[0] ? { ...created[0], email: user.email } : null;
  }

  // Unconfirmed session with no profile: not something to self-heal (they
  // still need to confirm their email). Revoke it so middleware agrees
  // they're logged out, rather than bouncing between /login and /dashboard.
  await supabase.auth.signOut();
  return null;
}
