import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/session';
import { getMyThreads } from '@/lib/creator';
import { Card } from '@/components/ui/card';
import ThreadRow from '@/components/thread-row';

export const dynamic = 'force-dynamic';

export default async function MyThreadsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const threads = await getMyThreads(profile.id);
  const unreadCount = threads.filter((t) => t.isUnread).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Threads
          {unreadCount > 0 && (
            <span className="ml-2 text-lg font-medium text-primary">({unreadCount} unread)</span>
          )}
        </h1>
        <p className="text-muted-foreground">Moderation notes on your manga and chapters, newest first.</p>
      </div>

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
