'use client';

import Link from 'next/link';
import { markNotificationReadAction } from '@/app/notifications/actions';
import CoverPlaceholder from '@/components/cover-placeholder';
import SeriesCover from '@/components/series-cover';
import { cn } from '@/lib/cn';

// One row in the notification feed. Wrapped in a Link that also
// fires-and-forgets markNotificationReadAction on click (no need to block
// navigation on it — same non-blocking idea as elsewhere in this app).
// admin_notice has nowhere to link to, so it renders as a plain row instead.
export default function NotificationRow({ notification }) {
  function markRead() {
    if (!notification.isUnread) return;
    markNotificationReadAction(notification.id);
  }

  const avatar = notification.contentType ? (
    <SeriesCover
      src={notification.coverImage}
      title={notification.subtitle || notification.title}
      className="aspect-[2/3] w-10 shrink-0 rounded-sm"
      sizes="40px"
    />
  ) : notification.actor ? (
    notification.actor.avatar_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={notification.actor.avatar_url}
        alt={notification.actor.username}
        className="h-10 w-10 shrink-0 rounded-full border object-cover"
      />
    ) : (
      <CoverPlaceholder title={notification.actor.username} className="h-10 w-10 shrink-0 rounded-full border" />
    )
  ) : (
    <CoverPlaceholder title="?" className="h-10 w-10 shrink-0 rounded-full border" />
  );

  const content = (
    <>
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', notification.isUnread ? 'bg-primary' : 'bg-transparent')}
        aria-hidden="true"
      />
      {avatar}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className={cn('truncate text-sm', notification.isUnread ? 'font-semibold' : 'font-medium text-muted-foreground')}>
          {notification.title}
        </p>
        {notification.subtitle && (
          <p className="truncate text-xs text-muted-foreground">{notification.subtitle}</p>
        )}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{notification.relativeTime}</span>
    </>
  );

  if (!notification.href) {
    return (
      <div onClick={markRead} className="flex cursor-default items-center gap-3 px-4 py-3">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={notification.href}
      onClick={markRead}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent"
    >
      {content}
    </Link>
  );
}
