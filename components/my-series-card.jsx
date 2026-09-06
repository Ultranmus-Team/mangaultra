import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import StatusBadge from '@/components/status-badge';
import SeriesCover from '@/components/series-cover';

// Shared row-style card for "this creator's own series" — used on the
// dashboard listing and the "My manga" tab of the profile page.
export default function MySeriesCard({ series }) {
  return (
    <Link href={`/series/${series.canonical_slug}`}>
      <Card className="flex h-full gap-3 overflow-hidden p-3 transition-shadow hover:shadow-md">
        <SeriesCover
          src={series.cover_image}
          title={series.title}
          className="aspect-[2/3] w-16 shrink-0 rounded-md"
          sizes="64px"
        />
        <CardHeader className="flex-1 space-y-1.5 p-0">
          <div className="flex items-center justify-between">
            <StatusBadge status={series.moderation_status} />
            <span className="text-xs capitalize text-muted-foreground">{series.content_type}</span>
          </div>
          <CardTitle className="line-clamp-2 text-sm leading-snug">{series.title}</CardTitle>
          <CardDescription className="text-xs">{series.chapter_count} chapters</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
