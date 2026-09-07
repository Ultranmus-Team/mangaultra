import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/session';
import { getNotifications, getUnreadNotificationCount } from '@/lib/notifications';
import NotificationsFeed from '@/components/notifications-feed';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const [{ notifications, hasMore }, unreadCount] = await Promise.all([
    getNotifications(profile.id),
    getUnreadNotificationCount(profile.id),
  ]);

  return (
    <NotificationsFeed
      initialNotifications={notifications}
      initialHasMore={hasMore}
      initialUnreadCount={unreadCount}
    />
  );
}
