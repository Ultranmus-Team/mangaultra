import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getCurrentProfile } from '@/lib/session';
import { getChapterComment, getChapterCommentReplies } from '@/lib/social';
import AutoMarkRead from '@/components/auto-mark-read';
import CommentThread from '@/components/comment-thread';
import { markCommentNotificationsReadAction } from '@/app/notifications/actions';

export const dynamic = 'force-dynamic';

async function getChapterContext(slug, chapterNumber) {
  const { rows } = await query(
    `SELECT c.id, c.chapter_number, c.title, c.status,
            s.id AS series_id, s.canonical_slug, s.title AS series_title, s.creator_id, s.moderation_status
     FROM chapters c
     JOIN series s ON s.id = c.series_id
     WHERE s.canonical_slug = $1 AND c.chapter_number = $2`,
    [slug, chapterNumber]
  );
  return rows[0] || null;
}

export default async function CommentThreadPage({ params }) {
  const chapter = await getChapterContext(params.slug, params.number);
  if (!chapter) notFound();

  const profile = await getCurrentProfile();
  const canManage = profile?.id === chapter.creator_id || profile?.role === 'admin';
  const contentPath = `/series/${chapter.canonical_slug}/chapter/${chapter.chapter_number}`;
  if ((chapter.moderation_status !== 'approved' || chapter.status !== 'published') && !canManage) notFound();

  const commentId = Number(params.commentId);
  const comment = await getChapterComment(chapter.id, commentId);
  if (!comment) notFound();
  // Notifications always store the thread root, but a stale link (or a
  // reply id passed some other way) should land on its own thread rather
  // than 404ing.
  if (comment.parent_id) {
    redirect(`${contentPath}/comment/${comment.parent_id}`);
  }

  const repliesPage = await getChapterCommentReplies(chapter.id, commentId);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {profile && <AutoMarkRead action={markCommentNotificationsReadAction} args={[chapter.id, commentId]} />}
      <div>
        <Link href={contentPath} className="text-sm text-muted-foreground hover:underline">
          ← Chapter {chapter.chapter_number}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {chapter.series_title} — Chapter {chapter.chapter_number}
          {chapter.title ? ` — ${chapter.title}` : ''}
        </h1>
      </div>

      <CommentThread
        chapterId={chapter.id}
        rootComment={comment}
        initialReplies={repliesPage.replies}
        initialTotal={repliesPage.total}
        initialHasMore={repliesPage.hasMore}
        currentUserId={profile?.id ?? null}
        isAdmin={profile?.role === 'admin'}
        isLoggedIn={Boolean(profile)}
        chapterHref={contentPath}
      />
    </div>
  );
}
