import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { getCurrentProfile } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import ChapterReaderContent from '@/components/chapter-reader-content';
import ChapterMenu from '@/components/chapter-menu';
import ChapterReviewThread from '@/components/chapter-review-thread';
import ApproveChapterButton from '@/components/approve-chapter-button';
import ChapterReactions from '@/components/chapter-reactions';
import ChapterComments from '@/components/chapter-comments';
import CoverPlaceholder from '@/components/cover-placeholder';
import { getChapterReviewMessages } from '@/lib/creator';
import { getChapterComments, getChapterReactionState } from '@/lib/social';
import { formatRelativeTime } from '@/lib/util';

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

async function getAdjacentChapters(seriesId, chapterNumber, includeAll) {
  const { rows } = await query(
    `SELECT chapter_number FROM chapters
     WHERE series_id = $1 ${includeAll ? '' : "AND status = 'published'"}
     ORDER BY chapter_number ASC`,
    [seriesId]
  );
  const numbers = rows.map((r) => Number(r.chapter_number));
  const idx = numbers.indexOf(Number(chapterNumber));
  return {
    prev: idx > 0 ? numbers[idx - 1] : null,
    next: idx >= 0 && idx < numbers.length - 1 ? numbers[idx + 1] : null,
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
          <Card className="border-dashed">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Series is{' '}
              <span className="font-medium capitalize text-foreground">
                {series.moderation_status.replace('_', ' ')}
              </span>{' '}
              — only visible to you.
            </CardContent>
          </Card>
        )}

        {canManage && chapter.status === 'hidden' && (
          <Card className="border-dashed">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Hidden — only visible to you.
            </CardContent>
          </Card>
        )}

        {canManage && chapter.status === 'pending_review' && (
          <Card className="border-dashed">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <p className="text-sm text-muted-foreground">Pending review — only visible to you.</p>
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
          <Card className="border-dashed border-destructive/50">
            <CardContent className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="text-sm font-medium text-destructive">Chapter rejected — only visible to you</p>
                {chapter.rejection_reason && (
                  <p className="mt-1 text-sm text-muted-foreground">{chapter.rejection_reason}</p>
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

      <Card>
        <CardContent className="flex justify-center py-8">
          <ChapterReactions
            chapterId={chapter.id}
            initialCounts={reactionState.counts}
            initialUserReaction={reactionState.userReaction}
            isLoggedIn={Boolean(profile)}
          />
        </CardContent>
      </Card>

      {canManage && (chapter.status !== 'published' || reviewMessages.length > 0) && (
        <ChapterReviewThread seriesId={series.id} chapterId={chapter.id} messages={reviewMessages} />
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
