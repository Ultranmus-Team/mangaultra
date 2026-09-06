import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabaseServer';
import { getCurrentProfile } from '@/lib/session';
import { getMySeries } from '@/lib/creator';
import ProfileTabs from '@/components/profile-tabs';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const [series, { data }] = await Promise.all([
    getMySeries(profile.id),
    createClient().auth.getUser(),
  ]);

  const hasPassword = data.user?.identities?.some((i) => i.provider === 'email') ?? true;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your profile</h1>
        <p className="text-muted-foreground">Manage how other readers see you.</p>
      </div>

      <ProfileTabs profile={profile} series={series} hasPassword={hasPassword} />
    </div>
  );
}
