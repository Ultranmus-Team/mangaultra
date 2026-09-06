'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreVertical } from 'lucide-react';
import { setChapterVisibilityAction } from '@/app/dashboard/actions';

// Same menu, same options, wherever a chapter shows up for its owner or an
// admin — the chapter row in the series page, and the top of the chapter's
// own reading page.
export default function ChapterMenu({ seriesId, seriesSlug, chapterId, chapterNumber, hidden }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function toggleVisibility() {
    setOpen(false);
    startTransition(async () => {
      await setChapterVisibilityAction(seriesId, chapterId, !hidden);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Chapter options"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 w-40 pt-1">
          <div className="rounded-md border bg-background py-1 shadow-md">
            <Link
              href={`/series/${seriesSlug}/chapter/${chapterNumber}/edit`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              Edit
            </Link>
            <button
              type="button"
              disabled={isPending}
              onClick={toggleVisibility}
              className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
            >
              {hidden ? 'Unhide' : 'Hide'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
