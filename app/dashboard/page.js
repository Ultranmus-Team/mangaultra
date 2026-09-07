import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/session';
import { getMySeries, getUserBlockMessages, getThreadLastReadAt, isThreadUnread } from '@/lib/creator';
import { getAuthorFollowerCount } from '@/lib/follows';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import MySeriesCard from '@/components/my-series-card';
import UserBlockThread from '@/components/user-block-thread';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const [series, followerCount] = await Promise.all([getMySeries(profile.id), getAuthorFollowerCount(profile.id)]);
  const blockMessages = profile.is_banned ? await getUserBlockMessages(profile.id) : [];
  const lastReadAt = profile.is_banned ? await getThreadLastReadAt(profile.id, 'account', profile.id) : null;
  const latestMessage = blockMessages[blockMessages.length - 1];
  const isUnread = profile.is_banned && (await isThreadUnread(profile.id, 'account', profile.id, latestMessage?.created_at));

  return (
    <div className="space-y-8">
      {profile.is_banned && (
        <Card className="border-dashed border-destructive/50">
          <CardContent className="space-y-4 p-4">
            <div>
              <p className="text-sm font-medium text-destructive">Your account has been blocked</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You can't create new series, chapters, or comments. You can still manage what you already have. See
                below for the reason and to reach an admin.
              </p>
            </div>
            <UserBlockThread
              userId={profile.id}
              messages={blockMessages}
              isAdminView={false}
              unread={{
                isUnread,
                lastReadAt,
                threadType: 'account',
                threadId: profile.id,
                extraPaths: ['/dashboard'],
              }}
            />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your series</h1>
          <p className="text-muted-foreground">
            Manage your manga and novels · {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
          </p>
        </div>
        <Link href="/dashboard/new">
          <Button>New series</Button>
        </Link>
      </div>

      {series.length === 0 ? (
        <p className="text-muted-foreground">You haven't created a series yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {series.map((s) => (
            <MySeriesCard key={s.id} series={s} />
          ))}
        </div>
      )}
    </div>
  );
}
