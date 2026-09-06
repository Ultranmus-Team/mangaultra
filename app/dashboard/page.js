import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/session';
import { getMySeries } from '@/lib/creator';
import { Button } from '@/components/ui/button';
import MySeriesCard from '@/components/my-series-card';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const series = await getMySeries(profile.id);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your series</h1>
          <p className="text-muted-foreground">Manage your manga and novels.</p>
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
