import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/session';
import { getAllSeries, getPlatformSettings } from '@/lib/admin';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import AdminSeriesRow from '@/components/admin-series-row';
import PlatformSettingsForm from '@/components/platform-settings-form';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (profile.role !== 'admin') redirect('/dashboard');

  const [allSeries, settings] = await Promise.all([getAllSeries(), getPlatformSettings()]);
  const pending = allSeries.filter((s) => s.moderation_status === 'pending_review');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Moderation queue and platform controls.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform settings</CardTitle>
        </CardHeader>
        <CardContent>
          <PlatformSettingsForm settings={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending review ({pending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
          ) : (
            pending.map((s) => <AdminSeriesRow key={s.id} series={s} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All series ({allSeries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {allSeries.map((s) => (
            <AdminSeriesRow key={s.id} series={s} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
