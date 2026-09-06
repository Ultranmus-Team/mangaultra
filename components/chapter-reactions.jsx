'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setChapterReactionAction } from '@/app/series/actions';
import { cn } from '@/lib/cn';

// Facebook-style reaction set instead of a single like — picking the active
// one clears it, picking another swaps it. Counts are the raw signal a
// future trending/popular view would rank chapters on.
const REACTIONS = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'laugh', emoji: '😂', label: 'Haha' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
];

// Compact counts: 999 stays "999", 1,100 becomes "1.1k", 1,100,000 becomes
// "1.1m" — never more than a few characters regardless of magnitude.
function formatCount(n) {
  if (n < 1000) return String(n);
  let value = n / 1000;
  let suffix = 'k';
  if (value >= 1000) {
    value /= 1000;
    suffix = 'm';
  }
  let rounded = Math.round(value * 10) / 10;
  if (rounded >= 1000 && suffix === 'k') {
    rounded = Math.round((rounded / 1000) * 10) / 10;
    suffix = 'm';
  }
  return `${rounded}${suffix}`;
}

export default function ChapterReactions({ chapterId, initialCounts, initialUserReaction, isLoggedIn }) {
  const router = useRouter();
  const [counts, setCounts] = useState(initialCounts);
  const [userReaction, setUserReaction] = useState(initialUserReaction);
  const [isPending, startTransition] = useTransition();

  function pick(type) {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }

    const prevCounts = counts;
    const prevReaction = userReaction;
    const nextReaction = userReaction === type ? null : type;

    const nextCounts = { ...counts };
    if (prevReaction) nextCounts[prevReaction] = Math.max(0, (nextCounts[prevReaction] || 0) - 1);
    if (nextReaction) nextCounts[nextReaction] = (nextCounts[nextReaction] || 0) + 1;
    setCounts(nextCounts);
    setUserReaction(nextReaction);

    startTransition(async () => {
      const result = await setChapterReactionAction(chapterId, nextReaction);
      if (result?.error) {
        setCounts(prevCounts);
        setUserReaction(prevReaction);
        return;
      }
      setCounts(result.counts);
      setUserReaction(result.userReaction);
    });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        React to this chapter
      </span>
      <div className="flex items-start gap-5">
        {REACTIONS.map((r) => {
          const active = userReaction === r.type;
          const count = counts[r.type] || 0;
          return (
            <button
              key={r.type}
              type="button"
              disabled={isPending}
              onClick={() => pick(r.type)}
              aria-pressed={active}
              aria-label={r.label}
              className={cn(
                'flex w-10 flex-col items-center gap-1 transition-transform hover:scale-125 disabled:opacity-60',
                active ? 'scale-125' : 'opacity-70'
              )}
            >
              <span className="text-4xl leading-none">{r.emoji}</span>
              <span className={cn('text-xs leading-none text-muted-foreground', count === 0 && 'invisible')}>
                {formatCount(count)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 max-w-sm text-center text-[10px] leading-snug text-muted-foreground">
        Your reaction helps other readers discover this chapter and shows the author their work is landing.
      </p>
    </div>
  );
}
