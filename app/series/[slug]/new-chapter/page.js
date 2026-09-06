import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { getCurrentProfile } from '@/lib/session';
import { query } from '@/lib/db';
import MangaChapterEditor from '@/components/manga-chapter-editor';
import NovelChapterEditor from '@/components/novel-chapter-editor';

export const dynamic = 'force-dynamic';

export default async function NewChapterPage({ params }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const { rows } = await query('SELECT * FROM series WHERE canonical_slug = $1', [params.slug]);
  const series = rows[0];
  if (!series) notFound();
  if (series.creator_id !== profile.id) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link href={`/series/${series.canonical_slug}`} className="text-sm text-muted-foreground hover:underline">
          ← {series.title}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">New chapter</h1>
      </div>

      {series.content_type === 'manga' ? (
        <MangaChapterEditor seriesId={series.id} seriesSlug={series.canonical_slug} />
      ) : (
        <NovelChapterEditor seriesId={series.id} seriesSlug={series.canonical_slug} />
      )}
    </div>
  );
}
