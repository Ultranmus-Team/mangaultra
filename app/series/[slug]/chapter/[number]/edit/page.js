import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentProfile } from '@/lib/session';
import { query } from '@/lib/db';
import MangaChapterEditor from '@/components/manga-chapter-editor';
import NovelChapterEditor from '@/components/novel-chapter-editor';

export const dynamic = 'force-dynamic';

export default async function EditChapterPage({ params }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const { rows: seriesRows } = await query('SELECT * FROM series WHERE canonical_slug = $1', [params.slug]);
  const series = seriesRows[0];
  if (!series) notFound();

  const isOwner = series.creator_id === profile.id;
  const isAdmin = profile.role === 'admin';
  if (!isOwner && !isAdmin) redirect(`/series/${series.canonical_slug}/chapter/${params.number}`);

  const { rows: chapterRows } = await query(
    'SELECT * FROM chapters WHERE series_id = $1 AND chapter_number = $2',
    [series.id, params.number]
  );
  const chapter = chapterRows[0];
  if (!chapter) notFound();

  let pages = [];
  if (series.content_type === 'manga') {
    const { rows: pageRows } = await query(
      'SELECT storage_path, cdn_image_url FROM chapter_pages WHERE chapter_id = $1 ORDER BY page_number ASC',
      [chapter.id]
    );
    pages = pageRows.map((p) => ({ storagePath: p.storage_path, url: p.cdn_image_url }));
  }

  const initialChapter = {
    id: chapter.id,
    chapterNumber: chapter.chapter_number,
    title: chapter.title || '',
    body: chapter.body || '',
    pages,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href={`/series/${series.canonical_slug}/chapter/${chapter.chapter_number}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Chapter {chapter.chapter_number}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Edit chapter</h1>
      </div>

      {series.content_type === 'manga' ? (
        <MangaChapterEditor seriesId={series.id} seriesSlug={series.canonical_slug} initialChapter={initialChapter} />
      ) : (
        <NovelChapterEditor seriesId={series.id} seriesSlug={series.canonical_slug} initialChapter={initialChapter} />
      )}
    </div>
  );
}
