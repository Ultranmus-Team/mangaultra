import Link from 'next/link';
import { query } from '@/lib/db';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import SeriesCover from '@/components/series-cover';

export const dynamic = 'force-dynamic';

async function getApprovedSeries() {
  const { rows } = await query(
    `SELECT s.*, p.username AS creator_username,
            (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id AND c.status = 'published') AS chapter_count
     FROM series s
     JOIN profiles p ON p.id = s.creator_id
     WHERE s.moderation_status = 'approved'
     ORDER BY s.created_at DESC`
  );
  return rows;
}

export default async function HomePage() {
  const series = await getApprovedSeries();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Browse</h1>
        <p className="text-muted-foreground">Manga and novels published by our creator community.</p>
      </div>

      {series.length === 0 ? (
        <p className="text-muted-foreground">Nothing published yet. Be the first to submit a series.</p>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {series.map((s) => (
            <Link key={s.id} href={`/series/${s.canonical_slug}`}>
              <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                <SeriesCover
                  src={s.cover_image}
                  title={s.title}
                  className="aspect-[2/3] w-full"
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 45vw"
                />
                <CardHeader className="space-y-1.5 p-3">
                  <Badge variant="outline" className="w-fit capitalize">{s.content_type}</Badge>
                  <CardTitle className="line-clamp-2 text-sm leading-snug">{s.title}</CardTitle>
                  <CardDescription className="text-xs">
                    by {s.creator_username} · {s.chapter_count} chapters
                  </CardDescription>
                  {s.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {s.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
