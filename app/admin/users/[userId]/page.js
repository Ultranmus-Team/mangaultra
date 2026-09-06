import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUserById, getAllSeries } from '@/lib/admin';
import { getUserBlockMessages } from '@/lib/creator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import BlockUserButton from '@/components/block-user-button';
import UnblockUserButton from '@/components/unblock-user-button';
import UserBlockThread from '@/components/user-block-thread';
import StatusBadge from '@/components/status-badge';

export const dynamic = 'force-dynamic';

export default async function AdminUserPage({ params }) {
  const user = await getUserById(params.userId);
  if (!user) notFound();

  const [messages, allSeries] = await Promise.all([
    getUserBlockMessages(user.id),
    getAllSeries(),
  ]);
  const series = allSeries.filter((s) => s.creator_id === user.id);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:underline">
          ← Users
        </Link>
        <div className="mt-1 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{user.username}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{user.role}</Badge>
              {user.is_banned && <Badge variant="destructive">Blocked</Badge>}
            </div>
          </div>
          {user.role !== 'admin' && (user.is_banned ? (
            <UnblockUserButton userId={user.id} />
          ) : (
            <BlockUserButton userId={user.id} />
          ))}
        </div>
      </div>

      {(user.is_banned || messages.length > 0) && (
        <UserBlockThread userId={user.id} messages={messages} isAdminView />
      )}

      <div className="space-y-2">
        <h2 className="text-lg font-medium">Series ({series.length})</h2>
        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground">No series yet.</p>
        ) : (
          <Card className="divide-y">
            {series.map((s) => (
              <Link
                key={s.id}
                href={`/series/${s.canonical_slug}`}
                className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-accent"
              >
                <span className="font-medium">{s.title}</span>
                <StatusBadge status={s.moderation_status} />
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
