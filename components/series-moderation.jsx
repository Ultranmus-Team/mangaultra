'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  approveSeriesAction,
  rejectSeriesAction,
  delistSeriesAction,
  deleteSeriesAction,
} from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// Admin-only moderation controls for the unified series page — the same
// actions that used to live only on /admin/series/[seriesId].
export default function SeriesModeration({ seriesId, moderationStatus }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState('');

  function run(action, ...args) {
    setError(null);
    startTransition(async () => {
      const result = await action(seriesId, ...args);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setShowRejectForm(false);
      router.refresh();
    });
  }

  function runDelete() {
    if (!window.confirm('Permanently delete this series and all its chapters?')) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSeriesAction(seriesId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push('/admin');
    });
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Moderation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {moderationStatus === 'pending_review' && (
            <>
              <Button size="sm" disabled={isPending} onClick={() => run(approveSeriesAction)}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => setShowRejectForm((v) => !v)}
              >
                Reject
              </Button>
            </>
          )}
          {moderationStatus === 'approved' && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(delistSeriesAction)}>
              Delist
            </Button>
          )}
          <Button size="sm" variant="destructive" disabled={isPending} onClick={runDelete}>
            Delete
          </Button>
        </div>

        {showRejectForm && (
          <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
            <Textarea
              placeholder="Reason for rejection (shown to the creator)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" disabled={isPending} onClick={() => run(rejectSeriesAction, reason)}>
                Confirm reject
              </Button>
              <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setShowRejectForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
