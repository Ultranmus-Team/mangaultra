import { getChaptersByStatus } from '@/lib/admin';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import AdminChapterRow from '@/components/admin-chapter-row';

export const dynamic = 'force-dynamic';

export default async function AdminChaptersPage() {
  const [pendingChapters, rejectedChapters] = await Promise.all([
    getChaptersByStatus('pending_review'),
    getChaptersByStatus('rejected'),
  ]);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending chapters ({pendingChapters.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingChapters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chapters waiting for review.</p>
          ) : (
            pendingChapters.map((c) => <AdminChapterRow key={c.id} chapter={c} />)
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rejected chapters ({rejectedChapters.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {rejectedChapters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rejected chapters.</p>
          ) : (
            rejectedChapters.map((c) => <AdminChapterRow key={c.id} chapter={c} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}
