import { notFound, redirect } from 'next/navigation';
import { query } from '@/lib/db';

// Superseded by the unified /series/[slug]/chapter/[number] page — kept as
// a redirect so old links still land somewhere.
export default async function LegacyChapterRedirect({ params }) {
  const { rows } = await query(
    `SELECT s.canonical_slug, c.chapter_number
     FROM chapters c JOIN series s ON s.id = c.series_id
     WHERE c.id = $1 AND c.series_id = $2`,
    [Number(params.chapterId), Number(params.seriesId)]
  );
  if (!rows[0]) notFound();
  redirect(`/series/${rows[0].canonical_slug}/chapter/${rows[0].chapter_number}`);
}
