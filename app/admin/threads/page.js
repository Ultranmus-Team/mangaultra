import { getCurrentProfile } from '@/lib/session';
import { getAllThreads } from '@/lib/admin';
import { Card } from '@/components/ui/card';
import ThreadRow from '@/components/thread-row';

export const dynamic = 'force-dynamic';

export default async function AdminThreadsPage() {
  const profile = await getCurrentProfile();
  const threads = await getAllThreads(profile.id);
  const unreadCount = threads.filter((t) => t.isUnread).length;

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-medium">
        Threads ({threads.length})
        {unreadCount > 0 && <span className="ml-2 text-primary">· {unreadCount} unread</span>}
      </h2>
      {threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No threads yet.</p>
      ) : (
        <Card className="divide-y">
          {threads.map((t) => (
            <ThreadRow key={`${t.type}-${t.id}`} thread={t} />
          ))}
        </Card>
      )}
    </div>
  );
}
