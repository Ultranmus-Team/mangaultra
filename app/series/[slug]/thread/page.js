import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getCurrentProfile } from '@/lib/session';
import {
  getSeriesReviewMessages,
  getSeriesReviewMessageCount,
  getThreadLastReadAt,
  getSeriesFirstUnreadIndex,
} from '@/lib/creator';
import SeriesReviewThread from '@/components/series-review-thread';

export const dynamic = 'force-dynamic';

// Chat-style opening window: land on the last INITIAL_WINDOW messages if
// everything's read, or on the first unread message (with a little older
// context above it) if not — older history beyond that loads on scroll.
const INITIAL_WINDOW = 20;
const UNREAD_CONTEXT = 10;

async function getSeriesContext(slug) {
  const { rows } = await query(
    `SELECT id, canonical_slug, title, creator_id FROM series WHERE canonical_slug = $1`,
    [slug]
  );
  return rows[0] || null;
}

export default async function SeriesThreadPage({ params }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const series = await getSeriesContext(params.slug);
  if (!series) notFound();

  const isOwner = profile.id === series.creator_id;
  const isAdmin = profile.role === 'admin';
  if (!isOwner && !isAdmin) {
    redirect(`/series/${series.canonical_slug}`);
  }

  const total = await getSeriesReviewMessageCount(series.id);
  const lastReadAt = await getThreadLastReadAt(profile.id, 'series', series.id);
  const firstUnreadIndex = await getSeriesFirstUnreadIndex(series.id, lastReadAt);
  const isUnread = firstUnreadIndex < total;

  const initialOffset = isUnread
    ? Math.max(0, firstUnreadIndex - UNREAD_CONTEXT)
    : Math.max(0, total - INITIAL_WINDOW);

  const messages =
    total > 0 ? await getSeriesReviewMessages(series.id, { limit: total - initialOffset, offset: initialOffset }) : [];

  const contentPath = `/series/${series.canonical_slug}`;
  const basePath = `${contentPath}/thread`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href={contentPath} className="text-sm text-muted-foreground hover:underline">
          ← {series.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Review thread — {series.title}</h1>
      </div>

      <SeriesReviewThread
        seriesId={series.id}
        messages={messages}
        initialOffset={initialOffset}
        unread={{
          isUnread,
          lastReadAt,
          threadType: 'series',
          threadId: series.id,
          extraPaths: [contentPath, basePath],
        }}
      />
    </div>
  );
}
