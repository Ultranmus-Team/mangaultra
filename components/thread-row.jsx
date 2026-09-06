import Link from 'next/link';
import { ExternalLink, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import SeriesCover from '@/components/series-cover';
import MarkThreadReadButton from '@/components/mark-thread-read-button';
import { formatRelativeTime } from '@/lib/util';
import { cn } from '@/lib/cn';

const KIND_LABEL = {
  resubmit: { label: 'Resubmitted', variant: 'secondary' },
  reject: { label: 'Rejected', variant: 'destructive' },
  approve: { label: 'Approved', variant: 'default' },
  delist: { label: 'Delisted', variant: 'destructive' },
  block: { label: 'Blocked', variant: 'destructive' },
  unblock: { label: 'Unblocked', variant: 'default' },
};

// "Manga chapter" / "Novel chapter" for a chapter thread, "Manga" / "Novel"
// for a series thread — the real content type, not just "Chapter"/"Manga"
// regardless of what the series actually is.
function typeLabel(thread) {
  if (thread.type === 'account') return 'Account';
  const contentLabel = thread.contentType === 'novel' ? 'Novel' : 'Manga';
  return thread.type === 'chapter' ? `${contentLabel} chapter` : contentLabel;
}

// One row in a thread inbox (both the author's own and the admin's
// platform-wide version) — the latest message in a chapter/series/account
// moderation thread, linking straight to where that thread actually lives.
// The info area and the actions are two separate elements (not one row-wide
// <Link>) so "Mark as read" can be a real button instead of a link-styled
// span sitting inside another link.
export default function ThreadRow({ thread }) {
  const kind = KIND_LABEL[thread.kind];

  return (
    <div className="flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4">
      <Link
        href={thread.href}
        className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1 transition-colors hover:bg-accent"
      >
        <span
          className={cn('h-2 w-2 shrink-0 rounded-full', thread.isUnread ? 'bg-primary' : 'bg-transparent')}
          aria-hidden="true"
        />

        {thread.type === 'account' ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
        ) : (
          <SeriesCover
            src={thread.coverImage}
            title={thread.title}
            className="aspect-[2/3] w-10 shrink-0 rounded-sm"
            sizes="40px"
          />
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{typeLabel(thread)}</Badge>
            {kind && <Badge variant={kind.variant}>{kind.label}</Badge>}
          </div>
          <p className={cn('truncate', thread.isUnread ? 'font-semibold' : 'font-medium text-muted-foreground')}>
            {thread.title}
          </p>
          {thread.subtitle && <p className="text-xs text-muted-foreground">{thread.subtitle}</p>}
          {thread.body && (
            <blockquote className="truncate border-l-2 pl-2 text-xs italic text-muted-foreground">
              “{thread.body}”
            </blockquote>
          )}
        </div>
      </Link>

      <div className="flex shrink-0 flex-col gap-2 sm:items-end sm:gap-1.5">
        <span className="text-xs text-muted-foreground sm:text-right">{formatRelativeTime(thread.createdAt)}</span>
        {/* Full-width, evenly split on mobile so both buttons are easy
            touch targets; compact and right-aligned from sm: up. */}
        <div className="flex gap-2 sm:justify-end">
          {thread.isUnread && (
            <MarkThreadReadButton
              threadType={thread.type}
              threadId={thread.id}
              variant="outline"
              className="flex-1 sm:flex-none"
            />
          )}
          <Link href={thread.href} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'flex-1 sm:flex-none')}>
            View
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
