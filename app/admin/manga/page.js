import { getAllSeries } from '@/lib/admin';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import AdminSeriesRow from '@/components/admin-series-row';

export const dynamic = 'force-dynamic';

export default async function AdminMangaPage() {
  const allSeries = await getAllSeries();
  const pendingSeries = allSeries.filter((s) => s.moderation_status === 'pending_review');
  const rejectedSeries = allSeries.filter((s) => s.moderation_status === 'rejected');

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending manga ({pendingSeries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
          ) : (
            pendingSeries.map((s) => <AdminSeriesRow key={s.id} series={s} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rejected manga ({rejectedSeries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rejectedSeries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rejected manga.</p>
          ) : (
            rejectedSeries.map((s) => <AdminSeriesRow key={s.id} series={s} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All manga ({allSeries.length})</CardTitle>
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
