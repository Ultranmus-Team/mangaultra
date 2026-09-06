import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getCurrentProfile } from '@/lib/session';
import { getPlatformSettings } from '@/lib/admin';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpNarrowWide, ArrowDownWideNarrow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SeriesCover from '@/components/series-cover';
import CoverPlaceholder from '@/components/cover-placeholder';
import StatusBadge from '@/components/status-badge';
import SubmitForReviewButton from '@/components/submit-for-review-button';
import SeriesModeration from '@/components/series-moderation';
import ChapterMenu from '@/components/chapter-menu';
import ReviewThreadPreview from '@/components/review-thread-preview';
import { formatRelativeTime } from '@/lib/util';
import { getSeriesReviewMessages, isThreadUnread } from '@/lib/creator';
import { SERIES_THREAD_KINDS } from '@/lib/thread-kinds';

export const dynamic = 'force-dynamic';

const CHAPTERS_PAGE_SIZE = 50;

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

async function getChapterCount(seriesId, includeAll) {
  const { rows } = await query(
    `SELECT COUNT(*) FROM chapters WHERE series_id = $1 ${includeAll ? '' : "AND status = 'published'"}`,
    [seriesId]
  );
  return Number(rows[0].count);
}

// Ordered by chapter_number so pagination reads front-to-back like a table
// of contents — a series with thousands of chapters never has to load them
// all at once. `sortDir` flips old-to-new vs new-to-old.
async function getChapters(seriesId, includeAll, { limit, offset, sortDir }) {
  const { rows } = await query(
    `SELECT id, chapter_number, title, status, created_at
     FROM chapters
     WHERE series_id = $1 ${includeAll ? '' : "AND status = 'published'"}
     ORDER BY chapter_number ${sortDir === 'desc' ? 'DESC' : 'ASC'}
     LIMIT $2 OFFSET $3`,
    [seriesId, limit, offset]
  );
  return rows;
}

async function chapterIsVisible(seriesId, chapterNumber, includeAll) {
  const { rows } = await query(
    `SELECT 1 FROM chapters WHERE series_id = $1 AND chapter_number = $2 ${includeAll ? '' : "AND status = 'published'"}`,
    [seriesId, chapterNumber]
  );
  return rows.length > 0;
}

export default async function SeriesPage({ params, searchParams }) {
  const series = await getSeries(params.slug);
  if (!series) notFound();

  const profile = await getCurrentProfile();
  const isOwner = profile?.id === series.creator_id;
  const isAdmin = profile?.role === 'admin';
  const canManage = isOwner || isAdmin;

  if (series.moderation_status !== 'approved' && !canManage) notFound();

  // "Jump to chapter" posts here as ?goto=<number> — skip straight to that
  // chapter's reading page rather than making the reader find it in a list
  // that could have thousands of entries. Checked against the same
  // visibility rule the chapter page itself enforces, so a bad or hidden
  // number surfaces as a clear message here instead of a bare 404.
  let gotoError = null;
  if (searchParams?.goto) {
    const isVisible = await chapterIsVisible(series.id, searchParams.goto, canManage);
    if (isVisible) {
      redirect(`/series/${series.canonical_slug}/chapter/${searchParams.goto}`);
    }
    gotoError = `Chapter ${searchParams.goto} doesn't exist or isn't available.`;
  }

  const sortDir = searchParams?.sort === 'desc' ? 'desc' : 'asc';
  const totalChapters = await getChapterCount(series.id, canManage);
  const totalPages = Math.max(1, Math.ceil(totalChapters / CHAPTERS_PAGE_SIZE));
  const requestedPage = parseInt(searchParams?.page, 10) || 1;
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const chapters = await getChapters(series.id, canManage, {
    limit: CHAPTERS_PAGE_SIZE,
    offset: (page - 1) * CHAPTERS_PAGE_SIZE,
    sortDir,
  });

  const { minChaptersForApproval } = isOwner ? await getPlatformSettings() : { minChaptersForApproval: 0 };
  const canSubmit =
    isOwner && ['draft', 'rejected'].includes(series.moderation_status) && totalChapters >= minChaptersForApproval;
  const reviewMessages = canManage ? await getSeriesReviewMessages(series.id) : [];
  const reviewIsUnread = canManage
    ? await isThreadUnread(profile.id, 'series', series.id, reviewMessages[reviewMessages.length - 1]?.created_at)
    : false;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <SeriesCover
            src={series.cover_image}
            title={series.title}
            className="mx-auto aspect-[2/3] w-full max-w-xs rounded-lg border md:mx-0 md:max-w-none"
            sizes="(min-width: 768px) 340px, 320px"
          />
          <div className="flex items-center gap-2">
            {canManage && <StatusBadge status={series.moderation_status} />}
            <Badge variant="outline" className="capitalize">{series.content_type}</Badge>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{series.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link
                href={`/u/${series.creator_username}`}
                className="flex items-center gap-2 font-medium text-foreground hover:underline"
              >
                {series.creator_avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={series.creator_avatar_url}
                    alt={series.creator_username}
                    className="h-6 w-6 rounded-full border object-cover"
                  />
                ) : (
                  <CoverPlaceholder title={series.creator_username} className="h-6 w-6 rounded-full border" />
                )}
                {series.creator_username}
              </Link>
            </div>
            {series.description && <p className="max-w-2xl text-muted-foreground">{series.description}</p>}
            {series.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {series.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">{tag}</Badge>
                ))}
              </div>
            )}
          </div>

          {isAdmin && <SeriesModeration seriesId={series.id} moderationStatus={series.moderation_status} />}

          {isOwner && series.moderation_status === 'rejected' && series.rejection_reason && (
            <Card className="border-dashed border-destructive/50 bg-destructive/5">
              <CardContent className="p-4">
                <StatusBadge status={series.moderation_status} />
                <p className="mt-2 text-sm text-muted-foreground">{series.rejection_reason}</p>
              </CardContent>
            </Card>
          )}

          {isOwner && ['draft', 'rejected'].includes(series.moderation_status) && (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-between p-4">
                <p className="text-sm text-muted-foreground">
                  {totalChapters} / {minChaptersForApproval} chapters uploaded.{' '}
                  {canSubmit ? 'Ready to submit for review.' : `Upload ${minChaptersForApproval - totalChapters} more to submit.`}
                </p>
                <SubmitForReviewButton
                  seriesId={series.id}
                  disabled={!canSubmit}
                  isResubmit={series.moderation_status === 'rejected'}
                />
              </CardContent>
            </Card>
          )}

          {isOwner && series.moderation_status === 'pending_review' && (
            <Card className="border-dashed bg-muted/40">
              <CardContent className="flex items-center gap-3 p-4">
                <StatusBadge status={series.moderation_status} />
                <p className="text-sm text-muted-foreground">
                  Awaiting admin review. New chapters can still be uploaded and will publish immediately once
                  approved.
                </p>
              </CardContent>
            </Card>
          )}

          {canManage && (!['approved', 'draft'].includes(series.moderation_status) || reviewMessages.length > 0) && (
            <ReviewThreadPreview
              messages={reviewMessages}
              kindLabels={SERIES_THREAD_KINDS}
              href={`/series/${series.canonical_slug}/thread`}
              isUnread={reviewIsUnread}
              threadType="series"
              threadId={series.id}
            />
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Chapters ({totalChapters})</h2>
              {isOwner && (
                <Link href={`/series/${series.canonical_slug}/new-chapter`}>
                  <Button size="sm">New chapter</Button>
                </Link>
              )}
            </div>

            {totalChapters > 1 && (
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col items-start gap-1">
                  <form
                    action={`/series/${series.canonical_slug}`}
                    method="GET"
                    className="flex items-center gap-1.5"
                  >
                    <input type="hidden" name="sort" value={sortDir} />
                    <input
                      type="number"
                      name="goto"
                      step="0.1"
                      placeholder="Chapter #"
                      className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <Button type="submit" variant="outline" size="sm">
                      Go
                    </Button>
                  </form>
                  {gotoError && <p className="text-xs text-destructive">{gotoError}</p>}
                </div>
                <Link
                  href={`/series/${series.canonical_slug}?sort=${sortDir === 'asc' ? 'desc' : 'asc'}`}
                  title={sortDir === 'asc' ? 'Showing oldest to newest — click to show newest to oldest' : 'Showing newest to oldest — click to show oldest to newest'}
                >
                  <Button type="button" variant="outline" size="icon" aria-label="Toggle chapter order">
                    {sortDir === 'asc' ? (
                      <ArrowUpNarrowWide className="h-4 w-4" />
                    ) : (
                      <ArrowDownWideNarrow className="h-4 w-4" />
                    )}
                  </Button>
                </Link>
              </div>
            )}

            {chapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chapters {canManage ? 'yet' : 'published yet'}.</p>
            ) : (
              <Card className="divide-y">
                {chapters.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <Link
                      href={`/series/${series.canonical_slug}/chapter/${c.chapter_number}`}
                      className="flex flex-1 items-center gap-2 font-medium transition-colors hover:text-muted-foreground"
                    >
                      <span>
                        Chapter {c.chapter_number}
                        {c.title ? ` — ${c.title}` : ''}
                      </span>
                      {c.status !== 'published' && <StatusBadge status={c.status} />}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{formatRelativeTime(c.created_at)}</span>
                      {canManage && (
                        <ChapterMenu
                          seriesId={series.id}
                          seriesSlug={series.canonical_slug}
                          chapterId={c.id}
                          chapterNumber={c.chapter_number}
                          status={c.status}
                          isOwner={isOwner}
                          isAdmin={isAdmin}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-3 pt-2">
                {page > 1 ? (
                  <Link href={`/series/${series.canonical_slug}?page=${page - 1}&sort=${sortDir}`}>
                    <Button variant="outline" size="sm">
                      ← Prev
                    </Button>
                  </Link>
                ) : (
                  <span />
                )}

                <form
                  action={`/series/${series.canonical_slug}`}
                  method="GET"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <input type="hidden" name="sort" value={sortDir} />
                  <span>Page</span>
                  <input
                    type="number"
                    name="page"
                    min={1}
                    max={totalPages}
                    defaultValue={page}
                    className="h-8 w-14 rounded-md border border-input bg-background px-2 text-center text-sm"
                  />
                  <span>of {totalPages}</span>
                  <Button type="submit" variant="outline" size="sm">
                    Go
                  </Button>
                </form>

                {page < totalPages ? (
                  <Link href={`/series/${series.canonical_slug}?page=${page + 1}&sort=${sortDir}`}>
                    <Button variant="outline" size="sm">
                      Next →
                    </Button>
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
