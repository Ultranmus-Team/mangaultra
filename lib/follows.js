import { query } from './db.js';
import * as notifications from './notifications.js';

// Matches assertValidChapterNumber in lib/creator.js — series_follows.min_chapter
// shares chapters.chapter_number's NUMERIC(6,1) shape, and a follower's
// threshold should accept exactly the values a chapter number could take.
function normalizeMinChapter(minChapter) {
  if (minChapter === null || minChapter === undefined || minChapter === '') return null;
  const n = Number(minChapter);
  if (!Number.isFinite(n) || n <= 0 || n >= 100000) {
    throw new Error('Minimum chapter must be a positive number.');
  }
  return Math.round(n * 10) / 10;
}

export async function followAuthor(followerId, authorId) {
  if (followerId === authorId) throw new Error('You cannot follow yourself.');
  const { rows } = await query(
    `INSERT INTO author_follows (follower_id, author_id) VALUES ($1, $2)
     ON CONFLICT (follower_id, author_id) DO NOTHING
     RETURNING id`,
    [followerId, authorId]
  );
  if (rows.length > 0) {
    await notifications.createNotification({ userId: authorId, type: 'new_follower', actorId: followerId });
  }
}

export async function unfollowAuthor(followerId, authorId) {
  await query('DELETE FROM author_follows WHERE follower_id = $1 AND author_id = $2', [followerId, authorId]);
}

export async function isFollowingAuthor(followerId, authorId) {
  if (!followerId) return false;
  const { rows } = await query('SELECT 1 FROM author_follows WHERE follower_id = $1 AND author_id = $2', [
    followerId,
    authorId,
  ]);
  return rows.length > 0;
}

export async function getAuthorFollowerCount(authorId) {
  const { rows } = await query('SELECT COUNT(*) FROM author_follows WHERE author_id = $1', [authorId]);
  return Number(rows[0].count);
}

// Re-following (already-followed series) updates the threshold instead of
// erroring, so the same action both follows and edits the setting.
// Unlike author_follows, series_follows has no DB-level constraint against
// following your own series (a series doesn't carry a fixed "owner" column
// to check against at that level), so it's enforced here — the one path
// every caller (UI, Server Action, any future script) goes through — rather
// than trusting the UI to keep hiding the Follow button for the owner.
export async function followSeries(followerId, seriesId, minChapter) {
  const cleanMinChapter = normalizeMinChapter(minChapter);
  const { rows: seriesRows } = await query('SELECT creator_id, title FROM series WHERE id = $1', [seriesId]);
  if (seriesRows.length === 0) throw new Error(`Series ${seriesId} not found`);
  if (seriesRows[0].creator_id === followerId) throw new Error('You cannot follow your own series.');

  // `xmax = 0` is Postgres' own tell for "this row was just inserted, not
  // updated by the ON CONFLICT clause" — used here so re-following (to edit
  // the threshold) doesn't re-notify the creator every time, only a
  // genuinely new follow does.
  const { rows } = await query(
    `INSERT INTO series_follows (follower_id, series_id, min_chapter) VALUES ($1, $2, $3)
     ON CONFLICT (follower_id, series_id) DO UPDATE SET min_chapter = EXCLUDED.min_chapter
     RETURNING (xmax = 0) AS inserted`,
    [followerId, seriesId, cleanMinChapter]
  );
  if (rows[0].inserted) {
    await notifications.createNotification({
      userId: seriesRows[0].creator_id,
      type: 'series_follower',
      actorId: followerId,
      seriesId,
    });
  }
  return { minChapter: cleanMinChapter };
}

export async function unfollowSeries(followerId, seriesId) {
  await query('DELETE FROM series_follows WHERE follower_id = $1 AND series_id = $2', [followerId, seriesId]);
}

export async function getSeriesFollowState(followerId, seriesId) {
  if (!followerId) return { following: false, minChapter: null };
  const { rows } = await query('SELECT min_chapter FROM series_follows WHERE follower_id = $1 AND series_id = $2', [
    followerId,
    seriesId,
  ]);
  if (rows.length === 0) return { following: false, minChapter: null };
  return { following: true, minChapter: rows[0].min_chapter !== null ? Number(rows[0].min_chapter) : null };
}

export async function getSeriesFollowerCount(seriesId) {
  const { rows } = await query('SELECT COUNT(*) FROM series_follows WHERE series_id = $1', [seriesId]);
  return Number(rows[0].count);
}
