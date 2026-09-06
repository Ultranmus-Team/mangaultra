import { query } from './db.js';
import { uploadPage, deleteObjects } from './storage.js';

const MAX_COMMENT_LENGTH = 2000;
const COMMENTS_PAGE_SIZE = 10;
const REPLIES_PAGE_SIZE = 5;

export const REACTION_TYPES = ['like', 'love', 'laugh', 'wow', 'sad'];

// Any logged-in reader can comment. Replies always attach to the top-level
// comment (Instagram-style flattening) — a reply to a reply is re-parented
// to that reply's own top-level ancestor rather than nesting further.
export async function addChapterComment(authorId, seriesId, chapterId, { body, imageBuffer, parentId } = {}) {
  const cleanBody = body?.trim()?.slice(0, MAX_COMMENT_LENGTH) || null;
  if (!cleanBody && !imageBuffer) throw new Error('Comment must include text or an image');

  let parentTopLevelId = null;
  if (parentId) {
    const { rows } = await query(
      'SELECT id, parent_id FROM chapter_comments WHERE id = $1 AND chapter_id = $2',
      [parentId, chapterId]
    );
    if (rows.length === 0) throw new Error('Comment being replied to no longer exists');
    parentTopLevelId = rows[0].parent_id || rows[0].id;
  }

  let imageUrl = null;
  let storagePath = null;
  if (imageBuffer) {
    storagePath = `series/${seriesId}/chapters/${chapterId}/comments/${Date.now()}-${Math.round(Math.random() * 1e6)}.webp`;
    const uploaded = await uploadPage(imageBuffer, storagePath);
    imageUrl = uploaded.cdnUrl;
  }

  const { rows } = await query(
    `INSERT INTO chapter_comments (chapter_id, author_id, parent_id, body, image_url, storage_path)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [chapterId, authorId, parentTopLevelId, cleanBody, imageUrl, storagePath]
  );
  return { commentId: rows[0].id };
}

// Deleting a top-level comment cascades its replies at the DB level (FK
// ON DELETE CASCADE), but their R2 images don't clean up on their own —
// those have to be collected and deleted explicitly first.
export async function deleteChapterComment(actorId, isAdmin, chapterId, commentId) {
  const { rows } = await query(
    'SELECT author_id, storage_path FROM chapter_comments WHERE id = $1 AND chapter_id = $2',
    [commentId, chapterId]
  );
  if (rows.length === 0) throw new Error('Comment not found');
  if (!isAdmin && rows[0].author_id !== actorId) throw new Error('You do not own this comment');

  const { rows: replyRows } = await query(
    'SELECT storage_path FROM chapter_comments WHERE parent_id = $1 AND storage_path IS NOT NULL',
    [commentId]
  );
  const storagePaths = [rows[0].storage_path, ...replyRows.map((r) => r.storage_path)].filter(Boolean);
  if (storagePaths.length > 0) await deleteObjects(storagePaths);

  await query('DELETE FROM chapter_comments WHERE id = $1', [commentId]);
  return { commentId };
}

// Top-level comments, newest first, each carrying its reply count but not
// the replies themselves — those load lazily (see getChapterCommentReplies)
// so a chapter with a long thread doesn't ship every reply up front.
export async function getChapterComments(chapterId, { limit = COMMENTS_PAGE_SIZE, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT c.id, c.body, c.image_url, c.created_at, c.author_id,
            p.username AS author_username, p.avatar_url AS author_avatar_url,
            (SELECT COUNT(*) FROM chapter_comments r WHERE r.parent_id = c.id) AS reply_count
     FROM chapter_comments c
     JOIN profiles p ON p.id = c.author_id
     WHERE c.chapter_id = $1 AND c.parent_id IS NULL
     ORDER BY c.created_at DESC
     LIMIT $2 OFFSET $3`,
    [chapterId, limit, offset]
  );
  const comments = rows.map((r) => ({ ...r, reply_count: Number(r.reply_count) }));

  const { rows: topCountRows } = await query(
    'SELECT COUNT(*) FROM chapter_comments WHERE chapter_id = $1 AND parent_id IS NULL',
    [chapterId]
  );
  const topTotal = Number(topCountRows[0].count);

  // Displayed total includes replies (what a reader thinks of as "how many
  // comments"); pagination itself only ever pages through top-level ones.
  const { rows: allCountRows } = await query('SELECT COUNT(*) FROM chapter_comments WHERE chapter_id = $1', [chapterId]);
  const total = Number(allCountRows[0].count);

  return { comments, total, hasMore: offset + comments.length < topTotal };
}

// Replies to one top-level comment, oldest first (chronological, like a
// conversation), paginated independently of the top-level comment list.
export async function getChapterCommentReplies(chapterId, parentId, { limit = REPLIES_PAGE_SIZE, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT c.id, c.body, c.image_url, c.created_at, c.author_id,
            p.username AS author_username, p.avatar_url AS author_avatar_url
     FROM chapter_comments c
     JOIN profiles p ON p.id = c.author_id
     WHERE c.chapter_id = $1 AND c.parent_id = $2
     ORDER BY c.created_at ASC
     LIMIT $3 OFFSET $4`,
    [chapterId, parentId, limit, offset]
  );
  const { rows: countRows } = await query('SELECT COUNT(*) FROM chapter_comments WHERE parent_id = $1', [parentId]);
  const total = Number(countRows[0].count);
  return { replies: rows, total, hasMore: offset + rows.length < total };
}

// Sets (or clears, or switches) the current user's reaction on a chapter —
// picking the reaction already active clears it, picking another swaps it.
// Pass `reactionType: null` to explicitly clear.
export async function setChapterReaction(userId, chapterId, reactionType) {
  if (reactionType !== null && !REACTION_TYPES.includes(reactionType)) {
    throw new Error('Invalid reaction type');
  }

  if (reactionType === null) {
    await query('DELETE FROM chapter_reactions WHERE chapter_id = $1 AND user_id = $2', [chapterId, userId]);
  } else {
    const { rows: existing } = await query(
      'SELECT reaction_type FROM chapter_reactions WHERE chapter_id = $1 AND user_id = $2',
      [chapterId, userId]
    );
    if (existing.length > 0 && existing[0].reaction_type === reactionType) {
      await query('DELETE FROM chapter_reactions WHERE chapter_id = $1 AND user_id = $2', [chapterId, userId]);
    } else {
      await query(
        `INSERT INTO chapter_reactions (chapter_id, user_id, reaction_type) VALUES ($1, $2, $3)
         ON CONFLICT (chapter_id, user_id) DO UPDATE SET reaction_type = EXCLUDED.reaction_type`,
        [chapterId, userId, reactionType]
      );
    }
  }

  return getChapterReactionState(chapterId, userId);
}

export async function getChapterReactionState(chapterId, userId) {
  const { rows: countRows } = await query(
    'SELECT reaction_type, COUNT(*) FROM chapter_reactions WHERE chapter_id = $1 GROUP BY reaction_type',
    [chapterId]
  );
  const counts = Object.fromEntries(REACTION_TYPES.map((t) => [t, 0]));
  for (const row of countRows) counts[row.reaction_type] = Number(row.count);

  let userReaction = null;
  if (userId) {
    const { rows } = await query(
      'SELECT reaction_type FROM chapter_reactions WHERE chapter_id = $1 AND user_id = $2',
      [chapterId, userId]
    );
    userReaction = rows[0]?.reaction_type || null;
  }
  return { counts, userReaction };
}
