import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import { getCurrentProfile } from '@/lib/session';
import { getMySeries } from '@/lib/creator';
import { getAuthorFollowerCount } from '@/lib/follows';
import ProfileTabs from '@/components/profile-tabs';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const [series, { data }, followerCount] = await Promise.all([
    getMySeries(profile.id),
    createClient().auth.getUser(),
    getAuthorFollowerCount(profile.id),
  ]);

  const hasPassword = data.user?.identities?.some((i) => i.provider === 'email') ?? true;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
          <p className="text-muted-foreground">
            Manage how other readers see you · {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
          </p>
        </div>
        <Link href="/dashboard/threads">
          <Button variant="outline" size="sm">Threads</Button>
        </Link>
      </div>

      <ProfileTabs profile={profile} series={series} hasPassword={hasPassword} />
    </div>
  );
}
