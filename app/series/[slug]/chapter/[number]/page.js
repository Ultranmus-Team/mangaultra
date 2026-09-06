import Link from 'next/link';
import { notFound } from 'next/navigation';
import { query } from '@/lib/db';
import { getCurrentProfile } from '@/lib/session';
import { Button } from '@/components/ui/button';
import ChapterReaderContent from '@/components/chapter-reader-content';
import ChapterMenu from '@/components/chapter-menu';

export const dynamic = 'force-dynamic';

async function getSeries(slug) {
  const { rows } = await query('SELECT * FROM series WHERE canonical_slug = $1', [slug]);
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href={`/series/${series.canonical_slug}`} className="text-sm text-muted-foreground hover:underline">
            {series.title}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            Chapter {chapter.chapter_number}
            {chapter.title ? ` — ${chapter.title}` : ''}
          </h1>
          {canManage && (series.moderation_status !== 'approved' || chapter.status !== 'published') && (
            <p className="text-sm text-muted-foreground">
              {series.moderation_status !== 'approved' ? `Series is ${series.moderation_status}` : 'Hidden'} — only visible to you.
            </p>
          )}
        </div>
        {canManage && (
          <ChapterMenu
            seriesId={series.id}
            seriesSlug={series.canonical_slug}
            chapterId={chapter.id}
            chapterNumber={chapter.chapter_number}
            hidden={chapter.status === 'hidden'}
          />
        )}
      </div>

      <ChapterReaderContent contentType={series.content_type} chapter={chapter} />

      <div className="flex items-center justify-between border-t pt-6">
        {prev ? (
          <Link href={`/series/${series.canonical_slug}/chapter/${prev}`}>
            <Button variant="outline">← Chapter {prev}</Button>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/series/${series.canonical_slug}/chapter/${next}`}>
            <Button variant="outline">Chapter {next} →</Button>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
