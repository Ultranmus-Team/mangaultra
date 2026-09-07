'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { loadMoreNotificationsAction, markAllNotificationsReadAction } from '@/app/notifications/actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import NotificationRow from '@/components/notification-row';

export default function NotificationsFeed({ initialNotifications, initialHasMore, initialUnreadCount }) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    startTransition(async () => {
      const result = await loadMoreNotificationsAction(notifications.length);
      setNotifications((prev) => [...prev, ...result.notifications]);
      setHasMore(result.hasMore);
    });
  }

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isUnread: false })));
    setUnreadCount(0);
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          Notifications
          {unreadCount > 0 && <span className="ml-2 text-lg font-medium text-primary">({unreadCount} unread)</span>}
        </h1>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" disabled={isPending} onClick={markAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notifications yet.</p>
      ) : (
        <Card className="divide-y">
          {notifications.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </Card>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={loadMore}>
            {isPending ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
