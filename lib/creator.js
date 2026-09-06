import sanitizeHtml from 'sanitize-html';
import { query } from './db.js';
import { uploadPage, deleteObjects } from './storage.js';
import { slugify } from './util.js';

// Novel chapter bodies come from a rich-text editor as HTML and are shown
// to other users on the public reader — sanitize before it ever reaches the
// database, since that's the one path every writer (UI, scripts) goes
// through.
const BODY_SANITIZE_OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li', 'a', 'code', 'pre'],
  allowedAttributes: { a: ['href', 'rel', 'target'] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow', target: '_blank' }),
  },
};

function sanitizeChapterBody(body) {
  return sanitizeHtml(body, BODY_SANITIZE_OPTIONS);
}

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;

// Accepts a comma-separated string (the create-series form field) or an
// array; trims, drops empties/duplicates (case-insensitively), and caps
// both the count and length of each tag so a creator can't push an
// unbounded array into the column.
function normalizeTags(raw) {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : String(raw).split(',');
  const seen = new Set();
  const tags = [];
  for (const item of list) {
    const tag = String(item).trim().slice(0, MAX_TAG_LENGTH);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

// Authoritative validation for chapter_number — enforced here (not just at
// the Server Action boundary) so any caller of this library gets the same
// guarantee. Matches the chapters.chapter_number NUMERIC(6,1) column.
function assertValidChapterNumber(chapterNumber) {
  const n = Number(chapterNumber);
  if (!Number.isFinite(n) || n <= 0 || n >= 100000) {
    throw new Error('Chapter number must be a positive number.');
  }
  return Math.round(n * 10) / 10;
}

async function assertOwnership(seriesId, creatorId) {
  const { rows } = await query(
    'SELECT id, creator_id, content_type, moderation_status FROM series WHERE id = $1',
    [seriesId]
  );
  if (rows.length === 0) throw new Error(`Series ${seriesId} not found`);
  if (rows[0].creator_id !== creatorId) throw new Error('You do not own this series');
  return rows[0];
}

async function assertCanManageSeries(seriesId, actorId, isAdmin) {
  const { rows } = await query('SELECT creator_id FROM series WHERE id = $1', [seriesId]);
  if (rows.length === 0) throw new Error(`Series ${seriesId} not found`);
  if (!isAdmin && rows[0].creator_id !== actorId) throw new Error('You do not own this series');
}

// A message-only entry in a series' moderation thread — no status change.
// `kind` defaults to a plain 'message' (body or image required); the
// approve/reject/delist/resubmit flows reuse this to log their own note as
// a typed entry in the same thread, where an empty note is fine (the kind
// itself is the news). Mirrors addChapterReviewMessage below.
export async function addSeriesReviewMessage(actorId, isAdmin, seriesId, { body, imageBuffer, kind = 'message' } = {}) {
  await assertCanManageSeries(seriesId, actorId, isAdmin);
  const cleanBody = body?.trim() || null;
  if (kind === 'message' && !cleanBody && !imageBuffer) {
    throw new Error('Message must include text or an image');
  }

  let imageUrl = null;
  let storagePath = null;
  if (imageBuffer) {
    storagePath = `series/${seriesId}/review/${Date.now()}.webp`;
    const uploaded = await uploadPage(imageBuffer, storagePath);
    imageUrl = uploaded.cdnUrl;
  }

  const { rows } = await query(
    `INSERT INTO series_review_messages (series_id, sender_id, kind, body, image_url, storage_path)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [seriesId, actorId, kind, cleanBody, imageUrl, storagePath]
  );
  return { messageId: rows[0].id };
}

export async function getSeriesReviewMessages(seriesId) {
  const { rows } = await query(
    `SELECT m.id, m.kind, m.body, m.image_url, m.created_at,
            p.username AS sender_username, p.avatar_url AS sender_avatar_url
     FROM series_review_messages m
     JOIN profiles p ON p.id = m.sender_id
     WHERE m.series_id = $1
     ORDER BY m.created_at ASC`,
    [seriesId]
  );
  return rows;
}

// The blocked user's one channel to reach an admin: an admin can message
// freely, the user can only post in their own thread (an appeal), enforced
// here rather than by the caller.
export async function addUserBlockMessage(actorId, isAdmin, targetUserId, { body, imageBuffer, kind = 'message' } = {}) {
  if (!isAdmin && actorId !== targetUserId) throw new Error('Not authorized');
  const cleanBody = body?.trim() || null;
  if (kind === 'message' && !cleanBody && !imageBuffer) {
    throw new Error('Message must include text or an image');
  }

  let imageUrl = null;
  let storagePath = null;
  if (imageBuffer) {
    storagePath = `users/${targetUserId}/block/${Date.now()}.webp`;
    const uploaded = await uploadPage(imageBuffer, storagePath);
    imageUrl = uploaded.cdnUrl;
  }

  const { rows } = await query(
    `INSERT INTO user_block_messages (user_id, sender_id, kind, body, image_url, storage_path)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [targetUserId, actorId, kind, cleanBody, imageUrl, storagePath]
  );
  return { messageId: rows[0].id };
}

export async function getUserBlockMessages(userId) {
  const { rows } = await query(
    `SELECT m.id, m.kind, m.body, m.image_url, m.created_at,
            p.username AS sender_username, p.avatar_url AS sender_avatar_url
     FROM user_block_messages m
     JOIN profiles p ON p.id = m.sender_id
     WHERE m.user_id = $1
     ORDER BY m.created_at ASC`,
    [userId]
  );
  return rows;
}

export async function createSeries(creatorId, { title, contentType, description, tags, coverImageBuffer }) {
  if (!['manga', 'novel'].includes(contentType)) {
    throw new Error(`Unsupported content_type "${contentType}". Only "manga" and "novel" are supported right now.`);
  }
  const cleanTags = normalizeTags(tags);
  const slug = `${slugify(title)}-${Math.random().toString(36).slice(2, 7)}`;
  const { rows } = await query(
    `INSERT INTO series (creator_id, canonical_slug, title, description, content_type, tags, moderation_status)
     VALUES ($1, $2, $3, $4, $5, $6, 'draft')
     RETURNING id, canonical_slug, title, content_type, tags, moderation_status`,
    [creatorId, slug, title, description || null, contentType, cleanTags]
  );
  const series = rows[0];

  // The cover image is optional and shown in place of an initials
  // placeholder — upload it after the insert so its storage path can be
  // keyed by the series' own DB-generated id.
  if (coverImageBuffer) {
    const storagePath = `series/${series.id}/cover.webp`;
    const { cdnUrl } = await uploadPage(coverImageBuffer, storagePath);
    await query('UPDATE series SET cover_image = $1 WHERE id = $2', [cdnUrl, series.id]);
    series.cover_image = cdnUrl;
  }

  return series;
}

export async function addMangaChapter(creatorId, seriesId, { chapterNumber, title, pageBuffers }) {
  const series = await assertOwnership(seriesId, creatorId);
  if (series.content_type !== 'manga') throw new Error('Series is not a manga series');
  if (!pageBuffers || pageBuffers.length === 0) throw new Error('At least one page image is required');
  chapterNumber = assertValidChapterNumber(chapterNumber);

  const { rows } = await query(
    `INSERT INTO chapters (series_id, chapter_number, title, status)
     VALUES ($1, $2, $3, 'published')
     RETURNING id`,
    [seriesId, chapterNumber, title || null]
  );
  const chapterId = rows[0].id;

  let pageNumber = 0;
  for (const buffer of pageBuffers) {
    pageNumber++;
    // Keyed by the DB-generated chapterId, not the user-supplied
    // chapterNumber — chapterNumber is display/ordering data a creator can
    // resubmit or a future edit feature could change, and it shouldn't
    // double as a storage identifier.
    const storagePath = `series/${seriesId}/chapters/${chapterId}/${String(pageNumber).padStart(3, '0')}.webp`;
    const { cdnUrl } = await uploadPage(buffer, storagePath);
    await query(
      `INSERT INTO chapter_pages (chapter_id, page_number, cdn_image_url, storage_path)
       VALUES ($1, $2, $3, $4)`,
      [chapterId, pageNumber, cdnUrl, storagePath]
    );
  }

  return { chapterId, pageCount: pageNumber };
}

export async function addNovelChapter(creatorId, seriesId, { chapterNumber, title, body }) {
  const series = await assertOwnership(seriesId, creatorId);
  if (series.content_type !== 'novel') throw new Error('Series is not a novel series');
  if (!body || body.trim().length === 0) throw new Error('Chapter body text is required');
  chapterNumber = assertValidChapterNumber(chapterNumber);

  const cleanBody = sanitizeChapterBody(body);
  if (!cleanBody || sanitizeHtml(cleanBody, { allowedTags: [] }).trim().length === 0) {
    throw new Error('Chapter body text is required');
  }

  const { rows } = await query(
    `INSERT INTO chapters (series_id, chapter_number, title, status, body)
     VALUES ($1, $2, $3, 'published', $4)
     RETURNING id`,
    [seriesId, chapterNumber, title || null, cleanBody]
  );
  return { chapterId: rows[0].id };
}

async function assertCanEditChapter(seriesId, chapterId, actorId, isAdmin) {
  const { rows } = await query(
    `SELECT s.creator_id, s.content_type
     FROM chapters c
     JOIN series s ON s.id = c.series_id
     WHERE c.id = $1 AND c.series_id = $2`,
    [chapterId, seriesId]
  );
  if (rows.length === 0) throw new Error(`Chapter ${chapterId} not found`);
  const { creator_id: creatorId, content_type: contentType } = rows[0];
  if (!isAdmin && creatorId !== actorId) {
    throw new Error('You do not have permission to edit this chapter');
  }
  return { contentType };
}

async function assertChapterNumberFree(seriesId, chapterNumber, excludeChapterId) {
  const { rows } = await query(
    'SELECT id FROM chapters WHERE series_id = $1 AND chapter_number = $2 AND id != $3',
    [seriesId, chapterNumber, excludeChapterId]
  );
  if (rows.length > 0) {
    throw new Error(`Chapter ${chapterNumber} already exists for this series`);
  }
}

// Both the author (owner) and an admin can edit an already-published
// chapter's content — there's no "locked once live" state in this app.
export async function updateNovelChapter(actorId, isAdmin, seriesId, chapterId, { chapterNumber, title, body }) {
  const { contentType } = await assertCanEditChapter(seriesId, chapterId, actorId, isAdmin);
  if (contentType !== 'novel') throw new Error('Series is not a novel series');
  if (!body || body.trim().length === 0) throw new Error('Chapter body text is required');
  chapterNumber = assertValidChapterNumber(chapterNumber);

  const cleanBody = sanitizeChapterBody(body);
  if (!cleanBody || sanitizeHtml(cleanBody, { allowedTags: [] }).trim().length === 0) {
    throw new Error('Chapter body text is required');
  }

  await assertChapterNumberFree(seriesId, chapterNumber, chapterId);
  await query(
    'UPDATE chapters SET chapter_number = $1, title = $2, body = $3 WHERE id = $4',
    [chapterNumber, title || null, cleanBody, chapterId]
  );
  return { chapterId };
}

// `manifest` describes the final page order as a list of
// { type: 'existing', storagePath } (kept from before) or { type: 'new' }
// (consumes the next buffer from `newFileBuffers`, in order). Kept pages are
// not re-uploaded; only pages dropped from the manifest are deleted from R2.
export async function updateMangaChapter(
  actorId,
  isAdmin,
  seriesId,
  chapterId,
  { chapterNumber, title, manifest, newFileBuffers }
) {
  const { contentType } = await assertCanEditChapter(seriesId, chapterId, actorId, isAdmin);
  if (contentType !== 'manga') throw new Error('Series is not a manga series');
  if (!manifest || manifest.length === 0) throw new Error('At least one page image is required');
  chapterNumber = assertValidChapterNumber(chapterNumber);
  await assertChapterNumberFree(seriesId, chapterNumber, chapterId);

  const { rows: oldPages } = await query(
    'SELECT storage_path, cdn_image_url FROM chapter_pages WHERE chapter_id = $1',
    [chapterId]
  );
  const oldByPath = new Map(oldPages.map((p) => [p.storage_path, p.cdn_image_url]));

  let newFileIndex = 0;
  const finalPages = [];
  for (const entry of manifest) {
    if (entry?.type === 'existing') {
      // Trust only the storage path from the client; the CDN URL always
      // comes from our own records so a client can't smuggle in an
      // arbitrary URL for a path it doesn't actually own.
      const cdnUrl = oldByPath.get(entry.storagePath);
      if (!cdnUrl) throw new Error('Invalid page reference');
      finalPages.push({ storagePath: entry.storagePath, cdnUrl });
    } else if (entry?.type === 'new') {
      const buffer = newFileBuffers[newFileIndex++];
      if (!buffer) throw new Error('Missing uploaded file for new page');
      // A timestamp (not the sequential page number) keys the storage path so
      // a re-edit can never collide with — or get served stale from a CDN
      // cache at — the path an earlier edit used.
      const storagePath = `series/${seriesId}/chapters/${chapterId}/${Date.now()}-${finalPages.length + 1}.webp`;
      const { cdnUrl } = await uploadPage(buffer, storagePath);
      finalPages.push({ storagePath, cdnUrl });
    } else {
      throw new Error('Invalid page manifest entry');
    }
  }

  const keptPaths = new Set(finalPages.map((p) => p.storagePath));
  const pathsToDelete = oldPages.map((p) => p.storage_path).filter((p) => !keptPaths.has(p));
  if (pathsToDelete.length > 0) await deleteObjects(pathsToDelete);

  await query('DELETE FROM chapter_pages WHERE chapter_id = $1', [chapterId]);
  let pageNumber = 0;
  for (const p of finalPages) {
    pageNumber++;
    await query(
      `INSERT INTO chapter_pages (chapter_id, page_number, cdn_image_url, storage_path)
       VALUES ($1, $2, $3, $4)`,
      [chapterId, pageNumber, p.cdnUrl, p.storagePath]
    );
  }

  await query('UPDATE chapters SET chapter_number = $1, title = $2 WHERE id = $3', [chapterNumber, title || null, chapterId]);
  return { chapterId, pageCount: pageNumber };
}

export async function setChapterVisibility(actorId, isAdmin, seriesId, chapterId, hidden) {
  await assertCanEditChapter(seriesId, chapterId, actorId, isAdmin);
  const { rows } = await query(
    'UPDATE chapters SET status = $2 WHERE id = $1 RETURNING id, series_id, chapter_number',
    [chapterId, hidden ? 'hidden' : 'published']
  );
  if (rows.length === 0) throw new Error(`Chapter ${chapterId} not found`);
  return rows[0];
}

// The author (owner) and an admin can both permanently delete a chapter.
// chapter_pages / chapter_review_messages / chapter_comments rows cascade
// on the FK, but the actual R2 objects don't — those have to be deleted
// explicitly first.
export async function deleteChapter(actorId, isAdmin, seriesId, chapterId) {
  await assertCanEditChapter(seriesId, chapterId, actorId, isAdmin);

  const { rows: pages } = await query('SELECT storage_path FROM chapter_pages WHERE chapter_id = $1', [chapterId]);
  const { rows: messages } = await query(
    'SELECT storage_path FROM chapter_review_messages WHERE chapter_id = $1 AND storage_path IS NOT NULL',
    [chapterId]
  );
  const { rows: comments } = await query(
    'SELECT storage_path FROM chapter_comments WHERE chapter_id = $1 AND storage_path IS NOT NULL',
    [chapterId]
  );
  const storagePaths = [
    ...pages.map((p) => p.storage_path),
    ...messages.map((m) => m.storage_path),
    ...comments.map((c) => c.storage_path),
  ];
  if (storagePaths.length > 0) await deleteObjects(storagePaths);

  await query('DELETE FROM chapters WHERE id = $1', [chapterId]);
  return { chapterId };
}

// A message-only entry in a chapter's moderation thread — no status change.
// `kind` defaults to a plain 'message' (body or image required); the
// reject/approve/resubmit flows below reuse this to log their own note as a
// typed entry in the same thread, where an empty note is fine (the kind
// itself is the news).
export async function addChapterReviewMessage(actorId, isAdmin, seriesId, chapterId, { body, imageBuffer, kind = 'message' } = {}) {
  await assertCanEditChapter(seriesId, chapterId, actorId, isAdmin);
  const cleanBody = body?.trim() || null;
  if (kind === 'message' && !cleanBody && !imageBuffer) {
    throw new Error('Message must include text or an image');
  }

  let imageUrl = null;
  let storagePath = null;
  if (imageBuffer) {
    storagePath = `series/${seriesId}/chapters/${chapterId}/review/${Date.now()}.webp`;
    const uploaded = await uploadPage(imageBuffer, storagePath);
    imageUrl = uploaded.cdnUrl;
  }

  const { rows } = await query(
    `INSERT INTO chapter_review_messages (chapter_id, sender_id, kind, body, image_url, storage_path)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [chapterId, actorId, kind, cleanBody, imageUrl, storagePath]
  );
  return { messageId: rows[0].id };
}

export async function getChapterReviewMessages(chapterId) {
  const { rows } = await query(
    `SELECT m.id, m.kind, m.body, m.image_url, m.created_at,
            p.username AS sender_username, p.avatar_url AS sender_avatar_url
     FROM chapter_review_messages m
     JOIN profiles p ON p.id = m.sender_id
     WHERE m.chapter_id = $1
     ORDER BY m.created_at ASC`,
    [chapterId]
  );
  return rows;
}

// Only the author can resubmit their own rejected chapter — an admin
// wanting to reverse their own rejection uses "Approve" directly instead.
export async function resubmitChapter(actorId, seriesId, chapterId, { body, imageBuffer } = {}) {
  const { rows } = await query(
    `SELECT c.status, s.creator_id
     FROM chapters c JOIN series s ON s.id = c.series_id
     WHERE c.id = $1 AND c.series_id = $2`,
    [chapterId, seriesId]
  );
  if (rows.length === 0) throw new Error(`Chapter ${chapterId} not found`);
  if (rows[0].creator_id !== actorId) throw new Error('You do not own this series');
  if (rows[0].status !== 'rejected') {
    throw new Error(`Chapter is "${rows[0].status}"; only a rejected chapter can be resubmitted`);
  }

  await addChapterReviewMessage(actorId, false, seriesId, chapterId, { body, imageBuffer, kind: 'resubmit' });
  await query(`UPDATE chapters SET status = 'pending_review' WHERE id = $1`, [chapterId]);
  return { chapterId };
}

export async function submitForApproval(creatorId, seriesId, { body, imageBuffer } = {}) {
  const series = await assertOwnership(seriesId, creatorId);
  if (!['draft', 'rejected'].includes(series.moderation_status)) {
    throw new Error(`Series is already "${series.moderation_status}"; cannot resubmit`);
  }
  const isResubmit = series.moderation_status === 'rejected';

  const { rows: pausedRows } = await query(`SELECT value FROM platform_settings WHERE key = 'uploads_paused'`);
  if (pausedRows[0]?.value === true) {
    throw new Error('Submissions are currently paused platform-wide');
  }

  const { rows: minRows } = await query(`SELECT value FROM platform_settings WHERE key = 'min_chapters_for_approval'`);
  const minChapters = typeof minRows[0]?.value === 'number' ? minRows[0].value : 10;

  const { rows: countRows } = await query('SELECT COUNT(*) FROM chapters WHERE series_id = $1', [seriesId]);
  const chapterCount = Number(countRows[0].count);
  if (chapterCount < minChapters) {
    throw new Error(`Series needs at least ${minChapters} chapters to submit for approval (has ${chapterCount})`);
  }

  await query(
    `UPDATE series SET moderation_status = 'pending_review', rejection_reason = NULL WHERE id = $1`,
    [seriesId]
  );
  if (isResubmit) {
    await addSeriesReviewMessage(creatorId, false, seriesId, { body, imageBuffer, kind: 'resubmit' });
  }
  return { seriesId, chapterCount };
}

export async function getMySeries(creatorId) {
  const { rows } = await query(
    `SELECT s.*, (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) AS chapter_count
     FROM series s WHERE s.creator_id = $1 ORDER BY s.created_at DESC`,
    [creatorId]
  );
  return rows;
}

export async function getSeriesForCreator(creatorId, seriesId) {
  const series = await assertOwnership(seriesId, creatorId);
  const { rows: full } = await query('SELECT * FROM series WHERE id = $1', [seriesId]);
  const { rows: chapters } = await query(
    'SELECT id, chapter_number, title, status, created_at FROM chapters WHERE series_id = $1 ORDER BY chapter_number ASC',
    [seriesId]
  );
  return { series: full[0], chapters };
}
