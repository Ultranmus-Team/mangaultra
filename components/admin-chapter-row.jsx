import Link from 'next/link';
import SeriesCover from '@/components/series-cover';

export default function AdminChapterRow({ chapter }) {
  return (
    <Link
      href={`/series/${chapter.canonical_slug}/chapter/${chapter.chapter_number}`}
      className="flex items-center gap-3 border-b py-3 text-sm transition-colors last:border-b-0 hover:bg-accent"
    >
      <SeriesCover
        src={chapter.cover_image}
        title={chapter.series_title}
        className="aspect-[2/3] w-10 shrink-0 rounded-sm"
        sizes="40px"
      />
      <div className="min-w-0 space-y-0.5">
        <p className="truncate font-medium">
          {chapter.series_title} — Chapter {chapter.chapter_number}
          {chapter.title ? ` — ${chapter.title}` : ''}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          by {chapter.creator_username}
          {chapter.rejection_reason ? ` · ${chapter.rejection_reason}` : ''}
        </p>
      </div>
    </Link>
  );
}
