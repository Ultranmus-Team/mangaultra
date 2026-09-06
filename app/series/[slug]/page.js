import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { getCurrentProfile } from '@/lib/session';
import { getPlatformSettings } from '@/lib/admin';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SeriesCover from '@/components/series-cover';
import StatusBadge from '@/components/status-badge';
import SubmitForReviewButton from '@/components/submit-for-review-button';
import SeriesModeration from '@/components/series-moderation';
import ChapterMenu from '@/components/chapter-menu';
import SeriesReviewThread from '@/components/series-review-thread';
import { formatRelativeTime } from '@/lib/util';
import { getSeriesReviewMessages } from '@/lib/creator';

export const dynamic = 'force-dynamic';

async function getSeries(slug) {
  const { rows } = await query(
    `SELECT s.*, p.username AS creator_username
     FROM series s
     JOIN profiles p ON p.id = s.creator_id
     WHERE s.canonical_slug = $1`,
    [slug]
  );
  return rows[0] || null;
}

async function getChapters(seriesId, includeAll) {
  const { rows } = await query(
    `SELECT id, chapter_number, title, status, created_at
     FROM chapters
     WHERE series_id = $1 ${includeAll ? '' : "AND status = 'published'"}
     ORDER BY chapter_number ASC`,
    [seriesId]
  );
  return rows;
}

export default async function SeriesPage({ params }) {
  const series = await getSeries(params.slug);
  if (!series) notFound();

  const profile = await getCurrentProfile();
  const isOwner = profile?.id === series.creator_id;
  const isAdmin = profile?.role === 'admin';
  const canManage = isOwner || isAdmin;

  if (series.moderation_status !== 'approved' && !canManage) notFound();

  const chapters = await getChapters(series.id, canManage);
  const { minChaptersForApproval } = isOwner ? await getPlatformSettings() : { minChaptersForApproval: 0 };
  const canSubmit =
    isOwner && ['draft', 'rejected'].includes(series.moderation_status) && chapters.length >= minChaptersForApproval;
  const reviewMessages = canManage ? await getSeriesReviewMessages(series.id) : [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <SeriesCover
            src={series.cover_image}
            title={series.title}
            className="aspect-[2/3] w-full max-w-xs rounded-lg border md:max-w-none"
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
            <p className="text-sm text-muted-foreground">
              by{' '}
              <Link href={`/u/${series.creator_username}`} className="font-medium text-foreground hover:underline">
                {series.creator_username}
              </Link>
            </p>
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
            <Card className="border-dashed border-destructive/50">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-destructive">Rejected</p>
                <p className="mt-1 text-sm text-muted-foreground">{series.rejection_reason}</p>
              </CardContent>
            </Card>
          )}

          {isOwner && ['draft', 'rejected'].includes(series.moderation_status) && (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-between p-4">
                <p className="text-sm text-muted-foreground">
                  {chapters.length} / {minChaptersForApproval} chapters uploaded.{' '}
                  {canSubmit ? 'Ready to submit for review.' : `Upload ${minChaptersForApproval - chapters.length} more to submit.`}
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
            <Card className="border-dashed">
              <CardContent className="p-4 text-sm text-muted-foreground">
                Awaiting admin review. New chapters can still be uploaded and will publish immediately once approved.
              </CardContent>
            </Card>
          )}

          {canManage && (!['approved', 'draft'].includes(series.moderation_status) || reviewMessages.length > 0) && (
            <SeriesReviewThread seriesId={series.id} messages={reviewMessages} />
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium">Chapters</h2>
              {isOwner && (
                <Link href={`/series/${series.canonical_slug}/new-chapter`}>
                  <Button size="sm">New chapter</Button>
                </Link>
              )}
            </div>
            {chapters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No chapters {canManage ? 'yet' : 'published yet'}.</p>
            ) : (
              <Card className="divide-y">
                {chapters.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                    <Link
                      href={`/series/${series.canonical_slug}/chapter/${c.chapter_number}`}
                      className="flex-1 font-medium transition-colors hover:text-muted-foreground"
                    >
                      Chapter {c.chapter_number}
                      {c.title ? ` — ${c.title}` : ''}
                      {c.status !== 'published' && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">({c.status})</span>
                      )}
                    </Link>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {canManage ? c.status : formatRelativeTime(c.created_at)}
                      </span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
