import Link from 'next/link';
import StatusBadge from '@/components/status-badge';
import SeriesCover from '@/components/series-cover';

// A pure "find and click through" row now — moderation actions (approve,
// reject, delist, delete) live on the unified /series/[slug] page itself
// (see components/series-moderation.jsx) so an admin lands on the same
// page a reader or the author would see, just with extra controls.
export default function AdminSeriesRow({ series }) {
  return (
    <Link
      href={`/series/${series.canonical_slug}`}
      className="flex items-start gap-3 border-b py-4 transition-colors last:border-b-0 hover:bg-accent"
    >
      <SeriesCover
        src={series.cover_image}
        title={series.title}
        className="aspect-[2/3] w-16 shrink-0 rounded-md"
        sizes="64px"
      />
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={series.moderation_status} />
          <span className="text-xs capitalize text-muted-foreground">{series.content_type}</span>
        </div>
        <p className="font-medium">{series.title}</p>
        <p className="text-xs text-muted-foreground">
          by {series.creator_username} · {series.chapter_count} chapters
        </p>
        {series.moderation_status === 'rejected' && series.rejection_reason && (
          <p className="text-xs text-destructive">Rejected: {series.rejection_reason}</p>
        )}
      </div>
    </Link>
  );
}
