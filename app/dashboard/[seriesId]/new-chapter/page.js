import { notFound, redirect } from 'next/navigation';
import { query } from '@/lib/db';

// Superseded by /series/[slug]/new-chapter — kept as a redirect so old
// links still land somewhere.
export default async function LegacyNewChapterRedirect({ params }) {
  const { rows } = await query('SELECT canonical_slug FROM series WHERE id = $1', [Number(params.seriesId)]);
  if (!rows[0]) notFound();
  redirect(`/series/${rows[0].canonical_slug}/new-chapter`);
}
