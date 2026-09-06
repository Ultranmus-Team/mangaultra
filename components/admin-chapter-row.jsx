import Link from 'next/link';

export default function AdminChapterRow({ chapter }) {
  return (
    <Link
      href={`/series/${chapter.canonical_slug}/chapter/${chapter.chapter_number}`}
      className="flex items-center justify-between gap-3 border-b py-3 text-sm transition-colors last:border-b-0 hover:bg-accent"
    >
      <div className="space-y-0.5">
        <p className="font-medium">
          {chapter.series_title} — Chapter {chapter.chapter_number}
          {chapter.title ? ` — ${chapter.title}` : ''}
        </p>
        <p className="text-xs text-muted-foreground">
          by {chapter.creator_username}
          {chapter.rejection_reason ? ` · ${chapter.rejection_reason}` : ''}
        </p>
      </div>
    </Link>
  );
}
