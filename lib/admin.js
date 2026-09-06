import { query } from './db.js';
import { deleteObjects } from './storage.js';

export async function approveSeries(seriesId) {
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
  return rows[0];
}

export async function rejectSeries(seriesId, reason) {
  const { rows } = await query(
    `UPDATE series SET moderation_status = 'rejected', rejection_reason = $2 WHERE id = $1 RETURNING id, title`,
    [seriesId, reason?.trim() || null]
  );
  if (rows.length === 0) throw new Error(`Series ${seriesId} not found`);
  return rows[0];
}

export async function delistSeries(seriesId) {
  const { rows } = await query(
    `UPDATE series SET moderation_status = 'delisted' WHERE id = $1 RETURNING id, title`,
    [seriesId]
  );
  if (rows.length === 0) throw new Error(`Series ${seriesId} not found`);
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
  const storagePaths = pageRows.map((r) => r.storage_path);
  await deleteObjects(storagePaths);
  await query('DELETE FROM series WHERE id = $1', [seriesId]);

  return { seriesId, deletedObjects: storagePaths.length };
}

export async function banCreator(creatorId) {
  const { rows } = await query(
    `UPDATE profiles SET is_banned = TRUE WHERE id = $1 RETURNING id, username`,
    [creatorId]
  );
  if (rows.length === 0) throw new Error(`Creator ${creatorId} not found`);
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

export async function getPlatformSettings() {
  const { rows } = await query('SELECT key, value FROM platform_settings');
  const settings = {};
  for (const row of rows) settings[row.key] = row.value;
  return {
    uploadsPaused: settings.uploads_paused === true,
    minChaptersForApproval: typeof settings.min_chapters_for_approval === 'number' ? settings.min_chapters_for_approval : 10,
  };
}
