import { query } from './db.js';
import { maskAdminIdentity, formatRelativeTime } from './util.js';

const PAGE_SIZE = 20;

const REACTION_EMOJI = { like: '👍', love: '❤️', laugh: '😂', wow: '😮', sad: '😢' };

// Generic insert behind every trigger below — never notify someone about
// their own action (replying to your own comment, reacting to your own
// chapter, an admin who is also the recipient, etc.).
export async function createNotification({
  userId,
  type,
  actorId = null,
  seriesId = null,
  chapterId = null,
  commentId = null,
  threadType = null,
  threadId = null,
  body = null,
}) {
  if (!userId || userId === actorId) return;
  await query(
    `INSERT INTO notifications (user_id, type, actor_id, series_id, chapter_id, comment_id, thread_type, thread_id, body)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [userId, type, actorId, seriesId, chapterId, commentId, threadType, threadId, body]
  );
}

// Fires once a series is approved (not on creation — see sql/schema.sql).
// `follower_id != $1` is belt-and-suspenders — author_follows already has a
// CHECK preventing a self-follow row from existing — but these bulk
// INSERT...SELECT notifiers bypass createNotification's own guard above, so
// each one repeats the exclusion itself rather than relying on it living
// only in the follow tables' constraints.
export async function notifyFollowersNewManga(authorId, seriesId) {
  await query(
    `INSERT INTO notifications (user_id, type, actor_id, series_id)
     SELECT follower_id, 'new_manga', $1, $2 FROM author_follows WHERE author_id = $1 AND follower_id != $1`,
    [authorId, seriesId]
  );
}

// Fires whenever a chapter becomes published — either freshly added, or a
// previously-rejected chapter going live via admin.approveChapter. Unlike
// author_follows, series_follows has no DB-level constraint against a
// creator following their own series, so `follower_id != $1` here is load-
// bearing, not just defensive (see followSeries in lib/follows.js for the
// matching guard at follow time).
export async function notifyFollowersNewChapter(seriesId, chapterId, chapterNumber, creatorId) {
  await query(
    `INSERT INTO notifications (user_id, type, actor_id, series_id, chapter_id)
     SELECT follower_id, 'new_chapter', $1, $2, $3
     FROM series_follows
     WHERE series_id = $2 AND follower_id != $1 AND (min_chapter IS NULL OR $4 >= min_chapter)`,
    [creatorId, seriesId, chapterId, chapterNumber]
  );
}

// Clears any still-unread thread_message notifications for one viewer's own
// reading position in a thread — called from markThreadRead below so
// opening (or posting into, or hitting "mark as read" on) a thread also
// syncs the corresponding notification-tab entry, instead of leaving it
// stuck unread after the viewer has plainly already seen it there.
export async function markThreadNotificationsRead(userId, threadType, threadId) {
  await query(
    `UPDATE notifications SET read_at = NOW()
     WHERE user_id = $1 AND type = 'thread_message' AND thread_type = $2 AND thread_id = $3 AND read_at IS NULL`,
    [userId, threadType, String(threadId)]
  );
}

// Same idea for a chapter's own page — visiting it means you've seen its
// reaction count and its "posted" state, so any new_chapter/reaction
// notification about that exact chapter is now stale. comment_reply and
// new_comment are deliberately excluded here: those point at one specific
// comment thread, not the chapter as a whole (see markCommentNotificationsRead).
export async function markChapterNotificationsRead(userId, chapterId) {
  await query(
    `UPDATE notifications SET read_at = NOW()
     WHERE user_id = $1 AND chapter_id = $2 AND type IN ('new_chapter', 'reaction') AND read_at IS NULL`,
    [userId, chapterId]
  );
}

// Visiting one comment's dedicated thread page (see lib/social.js's
// getChapterComment and the /comment/[commentId] route) clears only the
// notifications about THAT thread, not every comment notification on the
// chapter — a chapter can have many independent comment threads.
export async function markCommentNotificationsRead(userId, chapterId, commentId) {
  await query(
    `UPDATE notifications SET read_at = NOW()
     WHERE user_id = $1 AND chapter_id = $2 AND comment_id = $3
       AND type IN ('comment_reply', 'new_comment') AND read_at IS NULL`,
    [userId, chapterId, commentId]
  );
}

function buildNotification(row) {
  const actor = row.actor_username
    ? maskAdminIdentity(
        { username: row.actor_username, avatar_url: row.actor_avatar_url, role: row.actor_role },
        { usernameKey: 'username', avatarKey: 'avatar_url' }
      )
    : null;

  const contentLabel = row.content_type === 'novel' ? 'novel' : 'manga';
  let title = '';
  let subtitle = null;
  let href = null;

  switch (row.type) {
    case 'new_manga':
      title = `${actor.username} published a new ${contentLabel}`;
      subtitle = row.series_title;
      href = `/series/${row.canonical_slug}`;
      break;
    case 'new_chapter':
      title = `${actor.username} posted a new chapter`;
      subtitle = `${row.series_title} — Chapter ${row.chapter_number}`;
      href = `/series/${row.canonical_slug}/chapter/${row.chapter_number}`;
      break;
    case 'comment_reply':
      title = `${actor.username} replied to your comment`;
      subtitle = `${row.series_title} — Chapter ${row.chapter_number}`;
      href = `/series/${row.canonical_slug}/chapter/${row.chapter_number}/comment/${row.comment_id}`;
      break;
    case 'new_comment':
      title = `${actor.username} commented on your chapter`;
      subtitle = `${row.series_title} — Chapter ${row.chapter_number}`;
      href = `/series/${row.canonical_slug}/chapter/${row.chapter_number}/comment/${row.comment_id}`;
      break;
    case 'reaction':
      title = `${actor.username} reacted ${REACTION_EMOJI[row.body] || ''} to your chapter`;
      subtitle = `${row.series_title} — Chapter ${row.chapter_number}`;
      href = `/series/${row.canonical_slug}/chapter/${row.chapter_number}`;
      break;
    case 'new_follower':
      title = `${actor.username} started following you`;
      // An admin has no public profile page to link to — maskAdminIdentity
      // already replaces their username with the shared "MangaUltra Team"
      // display name, same as it's rendered as non-linkable plain text
      // anywhere else (comments, review threads); /u/MangaUltra%20Team
      // would just 404.
      href = actor.isAdminIdentity ? null : `/u/${actor.username}`;
      break;
    case 'thread_message':
      if (row.thread_type === 'account') {
        title = `${actor.username} sent you a message`;
        subtitle = row.body;
        href = '/dashboard';
      } else if (row.thread_type === 'chapter') {
        title = `New message on your ${contentLabel} chapter thread`;
        subtitle = `${row.series_title} — Chapter ${row.chapter_number}`;
        href = `/series/${row.canonical_slug}/chapter/${row.chapter_number}/thread`;
      } else {
        title = `New message on your ${contentLabel} thread`;
        subtitle = row.series_title;
        href = `/series/${row.canonical_slug}/thread`;
      }
      break;
    case 'admin_notice':
      title = 'Notice from MangaUltra Team';
      subtitle = row.body;
      href = null;
      break;
    default:
      title = 'Notification';
  }

  return {
    id: row.id,
    type: row.type,
    actor,
    title,
    subtitle,
    href,
    coverImage: row.cover_image,
    contentType: row.content_type,
    isUnread: !row.read_at,
    createdAt: row.created_at,
    relativeTime: formatRelativeTime(row.created_at),
  };
}

export async function getNotifications(userId, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT n.id, n.type, n.body, n.thread_type, n.comment_id, n.read_at, n.created_at,
            actor.username AS actor_username, actor.avatar_url AS actor_avatar_url, actor.role AS actor_role,
            s.title AS series_title, s.canonical_slug, s.content_type, s.cover_image,
            c.chapter_number
     FROM notifications n
     LEFT JOIN profiles actor ON actor.id = n.actor_id
     LEFT JOIN series s ON s.id = n.series_id
     LEFT JOIN chapters c ON c.id = n.chapter_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  const notifications = rows.map(buildNotification);

  const { rows: countRows } = await query('SELECT COUNT(*) FROM notifications WHERE user_id = $1', [userId]);
  const total = Number(countRows[0].count);

  return { notifications, total, hasMore: offset + notifications.length < total };
}

export async function getUnreadNotificationCount(userId) {
  const { rows } = await query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId]);
  return Number(rows[0].count);
}

export async function markNotificationRead(userId, notificationId) {
  await query('UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2 AND read_at IS NULL', [
    notificationId,
    userId,
  ]);
}

export async function markAllNotificationsRead(userId) {
  await query('UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL', [userId]);
}
