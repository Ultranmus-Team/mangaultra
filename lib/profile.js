import { query } from './db';
import { generateUsername } from './util';
import { uploadPage } from './storage';

// Called after any successful auth event (email confirmation, Google OAuth)
// to make sure a profiles row exists for the now-verified user.
export async function ensureProfile(user) {
  const { rows } = await query('SELECT id FROM profiles WHERE id = $1', [user.id]);
  if (rows.length === 0) {
    await query(
      'INSERT INTO profiles (id, username, email) VALUES ($1, $2, $3)',
      [user.id, generateUsername(user.email), user.email]
    );
  }
}

// Username is permanent once generated (it's baked into public profile/series
// URLs) — only bio and avatar are editable from here.
export async function updateProfile(userId, { bio, avatarBuffer }) {
  const cleanBio = bio?.trim().slice(0, 500) || null;

  let avatarUrl;
  if (avatarBuffer) {
    const storagePath = `profiles/${userId}/avatar.webp`;
    const { cdnUrl } = await uploadPage(avatarBuffer, storagePath);
    avatarUrl = cdnUrl;
  }

  const { rows } = await query(
    `UPDATE profiles
     SET bio = $1, avatar_url = COALESCE($2, avatar_url)
     WHERE id = $3
     RETURNING id, username, bio, avatar_url`,
    [cleanBio, avatarUrl || null, userId]
  );
  if (rows.length === 0) throw new Error('Profile not found');
  return rows[0];
}

// Public profile view: anyone can look up a creator by username and see
// their bio plus the series they've actually published — draft/pending/
// rejected work stays visible only on that creator's own dashboard.
export async function getPublicProfile(username) {
  const { rows: profileRows } = await query(
    'SELECT id, username, bio, avatar_url, created_at FROM profiles WHERE username = $1',
    [username]
  );
  if (profileRows.length === 0) return null;
  const profile = profileRows[0];

  const { rows: series } = await query(
    `SELECT s.id, s.title, s.canonical_slug, s.content_type, s.cover_image,
            (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id AND c.status = 'published') AS chapter_count
     FROM series s
     WHERE s.creator_id = $1 AND s.moderation_status = 'approved'
     ORDER BY s.created_at DESC`,
    [profile.id]
  );

  return { profile, series };
}
