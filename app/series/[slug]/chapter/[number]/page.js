import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { getCurrentProfile } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import StatusBadge from '@/components/status-badge';
import ChapterReaderContent from '@/components/chapter-reader-content';
import ChapterMenu from '@/components/chapter-menu';
import ReviewThreadPreview from '@/components/review-thread-preview';
import ApproveChapterButton from '@/components/approve-chapter-button';
import ChapterReactions from '@/components/chapter-reactions';
import ChapterComments from '@/components/chapter-comments';
import CoverPlaceholder from '@/components/cover-placeholder';
import { getChapterReviewMessages, isThreadUnread } from '@/lib/creator';
import { getChapterComments, getChapterReactionState } from '@/lib/social';
import { formatRelativeTime } from '@/lib/util';
import { CHAPTER_THREAD_KINDS } from '@/lib/thread-kinds';

export const dynamic = 'force-dynamic';

function ChapterNav({ seriesSlug, prev, next }) {
  return (
    <div className="flex items-center justify-between">
      {prev ? (
        <Link href={`/series/${seriesSlug}/chapter/${prev}`}>
          <Button variant="outline">← Chapter {prev}</Button>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={`/series/${seriesSlug}/chapter/${next}`}>
          <Button variant="outline">Chapter {next} →</Button>
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

async function getSeries(slug) {
  const { rows } = await query(
    `SELECT s.*, p.username AS creator_username, p.avatar_url AS creator_avatar_url
     FROM series s
     JOIN profiles p ON p.id = s.creator_id
     WHERE s.canonical_slug = $1`,
    [slug]
  );
  return rows[0] || null;
}

async function getChapter(seriesId, chapterNumber) {
  const { rows } = await query(
    'SELECT * FROM chapters WHERE series_id = $1 AND chapter_number = $2',
    [seriesId, chapterNumber]
  );
  return rows[0] || null;
}

// Two index-backed range lookups instead of loading every chapter_number
// for the series to find the immediate neighbors — matters once a series
// has thousands of chapters.
async function getAdjacentChapters(seriesId, chapterNumber, includeAll) {
  const statusFilter = includeAll ? '' : "AND status = 'published'";
  const [{ rows: prevRows }, { rows: nextRows }] = await Promise.all([
    query(
      `SELECT chapter_number FROM chapters
       WHERE series_id = $1 AND chapter_number < $2 ${statusFilter}
       ORDER BY chapter_number DESC LIMIT 1`,
      [seriesId, chapterNumber]
    ),
    query(
      `SELECT chapter_number FROM chapters
       WHERE series_id = $1 AND chapter_number > $2 ${statusFilter}
       ORDER BY chapter_number ASC LIMIT 1`,
      [seriesId, chapterNumber]
    ),
  ]);
  return {
    prev: prevRows[0] ? Number(prevRows[0].chapter_number) : null,
    next: nextRows[0] ? Number(nextRows[0].chapter_number) : null,
  };
}

export default async function ChapterPage({ params }) {
  const series = await getSeries(params.slug);
  if (!series) notFound();

  const profile = await getCurrentProfile();
  const isOwner = profile?.id === series.creator_id;
  const isAdmin = profile?.role === 'admin';
  const canManage = isOwner || isAdmin;

  if (series.moderation_status !== 'approved' && !canManage) notFound();

  const chapter = await getChapter(series.id, params.number);
  if (!chapter) notFound();
  if (chapter.status !== 'published' && !canManage) notFound();

  const { prev, next } = await getAdjacentChapters(series.id, params.number, canManage);
  const reviewMessages = canManage ? await getChapterReviewMessages(chapter.id) : [];
  const reviewIsUnread = canManage
    ? await isThreadUnread(profile.id, 'chapter', chapter.id, reviewMessages[reviewMessages.length - 1]?.created_at)
    : false;
  const [commentsPage, reactionState] = await Promise.all([
    getChapterComments(chapter.id),
    getChapterReactionState(chapter.id, profile?.id),
  ]);

  const chapterDate = formatRelativeTime(chapter.created_at);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Link
            href={`/series/${series.canonical_slug}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            {series.title}
          </Link>
          {canManage && (
            <ChapterMenu
              seriesId={series.id}
              seriesSlug={series.canonical_slug}
              chapterId={chapter.id}
              chapterNumber={chapter.chapter_number}
              status={chapter.status}
              isOwner={isOwner}
              isAdmin={isAdmin}
            />
          )}
        </div>

        {series.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {series.tags.map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
        )}

        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
          Chapter {chapter.chapter_number}
          {chapter.title ? ` — ${chapter.title}` : ''}
        </h1>

        {canManage && series.moderation_status !== 'approved' && (
          <Card className="border-dashed bg-muted/40">
            <CardContent className="flex items-center gap-3 p-4">
              <StatusBadge status={series.moderation_status} />
              <p className="text-sm text-muted-foreground">Series — only visible to you.</p>
            </CardContent>
          </Card>
        )}

        {canManage && chapter.status === 'hidden' && (
          <Card className="border-dashed bg-muted/40">
            <CardContent className="flex items-center gap-3 p-4">
              <StatusBadge status={chapter.status} />
              <p className="text-sm text-muted-foreground">Only visible to you.</p>
            </CardContent>
          </Card>
        )}

        {canManage && chapter.status === 'pending_review' && (
          <Card className="border-dashed bg-muted/40">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={chapter.status} />
                <p className="text-sm text-muted-foreground">Only visible to you.</p>
              </div>
              {isAdmin && (
                <ApproveChapterButton
                  seriesId={series.id}
                  chapterId={chapter.id}
                  chapterNumber={chapter.chapter_number}
                />
              )}
            </CardContent>
          </Card>
        )}

        {canManage && chapter.status === 'rejected' && (
          <Card className="border-dashed border-destructive/50 bg-destructive/5">
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={chapter.status} />
                  <p className="text-sm font-medium text-destructive">Only visible to you</p>
                </div>
                {chapter.rejection_reason && (
                  <p className="mt-2 text-sm text-muted-foreground">{chapter.rejection_reason}</p>
                )}
              </div>
              {isAdmin && (
                <ApproveChapterButton
                  seriesId={series.id}
                  chapterId={chapter.id}
                  chapterNumber={chapter.chapter_number}
                />
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <Link href={`/u/${series.creator_username}`} className="flex items-center gap-2.5">
            {series.creator_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={series.creator_avatar_url}
                alt={series.creator_username}
                className="h-10 w-10 rounded-full border object-cover"
              />
            ) : (
              <CoverPlaceholder title={series.creator_username} className="h-10 w-10 rounded-full border" />
            )}
            <span className="text-sm font-medium">{series.creator_username}</span>
          </Link>
          <span className="text-sm text-muted-foreground">{chapterDate}</span>
        </div>
      </div>

      <ChapterReaderContent contentType={series.content_type} chapter={chapter} />

      <ChapterNav seriesSlug={series.canonical_slug} prev={prev} next={next} />

      <Card className="border-dashed">
        <CardContent className="flex justify-center pb-4 pt-8">
          <ChapterReactions
            chapterId={chapter.id}
            initialCounts={reactionState.counts}
            initialUserReaction={reactionState.userReaction}
            isLoggedIn={Boolean(profile)}
          />
        </CardContent>
      </Card>

      {canManage && (chapter.status !== 'published' || reviewMessages.length > 0) && (
        <ReviewThreadPreview
          messages={reviewMessages}
          kindLabels={CHAPTER_THREAD_KINDS}
          href={`/series/${series.canonical_slug}/chapter/${chapter.chapter_number}/thread`}
          isUnread={reviewIsUnread}
          threadType="chapter"
          threadId={chapter.id}
        />
      )}

      <div className="border-t pt-6">
        <ChapterComments
          chapterId={chapter.id}
          initialComments={commentsPage.comments}
          initialTotal={commentsPage.total}
          initialHasMore={commentsPage.hasMore}
          currentUserId={profile?.id ?? null}
          isAdmin={isAdmin}
          isLoggedIn={Boolean(profile)}
        />
      </div>
    </div>
  );
}
