import Link from 'next/link';
import { Bell } from 'lucide-react';
import { getUnreadNotificationCount } from '@/lib/notifications';

// Server component — the badge is correct on every navigation since Navbar
// (its parent) already renders dynamically off the auth cookie, same as the
// rest of this app's unread indicators (see lib/creator.js's thread dots).
export default async function NotificationBell({ userId }) {
  const count = await getUnreadNotificationCount(userId);

  return (
    <Link
      href="/notifications"
      aria-label={count > 0 ? `Notifications (${count} unread)` : 'Notifications'}
      className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
