import { query } from './db.js';
import { deleteObjects } from './storage.js';
import { addChapterReviewMessage, addSeriesReviewMessage, addUserBlockMessage } from './creator.js';

export async function approveSeries(adminId, seriesId) {
  const { rows: seriesRows } = await query(
    'SELECT id, title, moderation_status FROM series WHERE id = $1',
    [seriesId]
  );
  if (seriesRows.length === 0) throw new Error(`Series ${seriesId} not found`);
  if (seriesRows[0].moderation_status !== 'pending_review') {
    throw new Error(`Series ${seriesId} is "${seriesRows[0].moderation_status}", not pending_review`);
  }

  const { rows: minRows } = await query(`SELECT value FROM platform_settings WHERE key = 'min_chapters_for_approval'`);
  const minChapters = typeof minRows[0]?.value === 'number' ? minRows[0].value : 10;
  const { rows: countRows } = await query('SELECT COUNT(*) FROM chapters WHERE series_id = $1', [seriesId]);
  if (Number(countRows[0].count) < minChapters) {
    throw new Error(`Series ${seriesId} has fewer than ${minChapters} chapters; cannot approve`);
  }

  const { rows } = await query(
    `UPDATE series SET moderation_status = 'approved' WHERE id = $1 RETURNING id, title`,
    [seriesId]
  );
  await addSeriesReviewMessage(adminId, true, seriesId, { kind: 'approve' });
  return rows[0];
}

export async function rejectSeries(adminId, seriesId, reason) {
  const cleanReason = reason?.trim() || null;
  const { rows } = await query(
    `UPDATE series SET moderation_status = 'rejected', rejection_reason = $2 WHERE id = $1 RETURNING id, title`,
    [seriesId, cleanReason]
  );
  if (rows.length === 0) throw new Error(`Series ${seriesId} not found`);
  await addSeriesReviewMessage(adminId, true, seriesId, { body: cleanReason, kind: 'reject' });
  return rows[0];
}

// Admin-only: hides a single chapter from readers with a reason shown to
// the creator, independent of the series' own moderation status. Logs the
// reason as a 'reject' entry in the chapter's review thread so the author
// sees it alongside any resubmission notes.
export async function rejectChapter(adminId, seriesId, chapterId, reason) {
  const cleanReason = reason?.trim() || null;
  const { rows } = await query(
    `UPDATE chapters SET status = 'rejected', rejection_reason = $2 WHERE id = $1
     RETURNING id, series_id, chapter_number`,
    [chapterId, cleanReason]
  );
  if (rows.length === 0) throw new Error(`Chapter ${chapterId} not found`);
  await addChapterReviewMessage(adminId, true, seriesId, chapterId, { body: cleanReason, kind: 'reject' });
  return rows[0];
}

// Publishes a rejected or pending-review chapter. Works from either state —
// an admin can approve a resubmission, or short-circuit straight past it —
// and clears the stale rejection reason either way.
export async function approveChapter(adminId, seriesId, chapterId, note) {
  const { rows: existing } = await query('SELECT status FROM chapters WHERE id = $1', [chapterId]);
  if (existing.length === 0) throw new Error(`Chapter ${chapterId} not found`);
  if (existing[0].status === 'published') throw new Error('Chapter is already published');

  const { rows } = await query(
    `UPDATE chapters SET status = 'published', rejection_reason = NULL WHERE id = $1
     RETURNING id, series_id, chapter_number`,
    [chapterId]
  );
  await addChapterReviewMessage(adminId, true, seriesId, chapterId, { body: note, kind: 'approve' });
  return rows[0];
}

export async function delistSeries(adminId, seriesId) {
  const { rows } = await query(
    `UPDATE series SET moderation_status = 'delisted' WHERE id = $1 RETURNING id, title`,
    [seriesId]
  );
  if (rows.length === 0) throw new Error(`Series ${seriesId} not found`);
  await addSeriesReviewMessage(adminId, true, seriesId, { kind: 'delist' });
  return rows[0];
}

export async function deleteSeriesCascade(seriesId) {
  const { rows: seriesRows } = await query('SELECT id, title FROM series WHERE id = $1', [seriesId]);
  if (seriesRows.length === 0) throw new Error(`Series ${seriesId} not found`);

  const { rows: pageRows } = await query(
    `SELECT cp.storage_path
     FROM chapter_pages cp
     JOIN chapters c ON cp.chapter_id = c.id
     WHERE c.series_id = $1`,
    [seriesId]
  );
  const { rows: chapterMsgRows } = await query(
    `SELECT crm.storage_path
     FROM chapter_review_messages crm
     JOIN chapters c ON c.id = crm.chapter_id
     WHERE c.series_id = $1 AND crm.storage_path IS NOT NULL`,
    [seriesId]
  );
  const { rows: seriesMsgRows } = await query(
    'SELECT storage_path FROM series_review_messages WHERE series_id = $1 AND storage_path IS NOT NULL',
    [seriesId]
  );
  const storagePaths = [
    ...pageRows.map((r) => r.storage_path),
    ...chapterMsgRows.map((r) => r.storage_path),
    ...seriesMsgRows.map((r) => r.storage_path),
  ];
  await deleteObjects(storagePaths);
  await query('DELETE FROM series WHERE id = $1', [seriesId]);

  return { seriesId, deletedObjects: storagePaths.length };
}

// Blocking prevents new posts (see assertNotBanned in app/dashboard/actions.js
// and the comment-post check in app/series/actions.js) without touching
// what the user already has, unless `hidePublished` is set — then every
// series they've gotten approved is delisted (not deleted) in the same
// move, and can be brought back with delistSeries's counterpart once
// unblocked. The reason is logged into the user's own block thread either
// way, which is also the one channel they have left to appeal.
export async function blockUser(adminId, userId, { reason, hidePublished } = {}) {
  const { rows } = await query(
    `UPDATE profiles SET is_banned = TRUE WHERE id = $1 RETURNING id, username`,
    [userId]
  );
  if (rows.length === 0) throw new Error(`User ${userId} not found`);

  if (hidePublished) {
    await query(
      `UPDATE series SET moderation_status = 'delisted' WHERE creator_id = $1 AND moderation_status = 'approved'`,
      [userId]
    );
  }

  await addUserBlockMessage(adminId, true, userId, { body: reason, kind: 'block' });
  return rows[0];
}

export async function unblockUser(adminId, userId) {
  const { rows } = await query(
    `UPDATE profiles SET is_banned = FALSE WHERE id = $1 RETURNING id, username`,
    [userId]
  );
  if (rows.length === 0) throw new Error(`User ${userId} not found`);
  await addUserBlockMessage(adminId, true, userId, { kind: 'unblock' });
  return rows[0];
}

export async function updatePlatformSettings({ uploadsPaused, minChaptersForApproval } = {}) {
  const writes = [];
  if (uploadsPaused !== undefined) {
    writes.push(query(
      `INSERT INTO platform_settings (key, value) VALUES ('uploads_paused', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb`,
      [JSON.stringify(uploadsPaused)]
    ));
  }
  if (minChaptersForApproval !== undefined) {
    writes.push(query(
      `INSERT INTO platform_settings (key, value) VALUES ('min_chapters_for_approval', $1::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb`,
      [JSON.stringify(minChaptersForApproval)]
    ));
  }
  if (writes.length === 0) {
    throw new Error('updatePlatformSettings requires at least one of uploadsPaused or minChaptersForApproval');
  }
  await Promise.all(writes);
}

export async function getSeriesForAdmin(seriesId) {
  const { rows: seriesRows } = await query(
    `SELECT s.*, p.username AS creator_username
     FROM series s JOIN profiles p ON p.id = s.creator_id
     WHERE s.id = $1`,
    [seriesId]
  );
  if (seriesRows.length === 0) throw new Error(`Series ${seriesId} not found`);

  const { rows: chapters } = await query(
    'SELECT id, chapter_number, title, status, created_at FROM chapters WHERE series_id = $1 ORDER BY chapter_number ASC',
    [seriesId]
  );
  return { series: seriesRows[0], chapters };
}

export async function getPendingSeries() {
  const { rows } = await query(
    `SELECT s.*, p.username AS creator_username,
            (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) AS chapter_count
     FROM series s
     JOIN profiles p ON p.id = s.creator_id
     WHERE s.moderation_status = 'pending_review'
     ORDER BY s.created_at ASC`
  );
  return rows;
}

export async function getAllSeries() {
  const { rows } = await query(
    `SELECT s.*, p.username AS creator_username,
            (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) AS chapter_count
     FROM series s
     JOIN profiles p ON p.id = s.creator_id
     ORDER BY s.created_at DESC`
  );
  return rows;
}

export async function getChaptersByStatus(status) {
  const { rows } = await query(
    `SELECT c.id, c.chapter_number, c.title, c.status, c.rejection_reason, c.created_at,
            s.canonical_slug, s.title AS series_title, p.username AS creator_username
     FROM chapters c
     JOIN series s ON s.id = c.series_id
     JOIN profiles p ON p.id = s.creator_id
     WHERE c.status = $1
     ORDER BY c.created_at ASC`,
    [status]
  );
  return rows;
}

export async function getAllUsers() {
  const { rows } = await query(
    `SELECT p.id, p.username, p.role, p.is_banned, p.created_at,
            (SELECT COUNT(*) FROM series s WHERE s.creator_id = p.id) AS series_count
     FROM profiles p
     ORDER BY p.created_at DESC`
  );
  return rows;
}

export async function getUserById(userId) {
  const { rows } = await query(
    `SELECT p.*, (SELECT COUNT(*) FROM series s WHERE s.creator_id = p.id) AS series_count
     FROM profiles p WHERE p.id = $1`,
    [userId]
  );
  return rows[0] || null;
}

export async function getPlatformSettings() {
  const { rows } = await query('SELECT key, value FROM platform_settings');
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  return {
    uploadsPaused: settings.uploads_paused === true,
    minChaptersForApproval: typeof settings.min_chapters_for_approval === 'number' ? settings.min_chapters_for_approval : 10,
  };
}
