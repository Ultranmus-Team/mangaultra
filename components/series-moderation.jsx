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
import Dialog from '@/components/ui/dialog';

// Admin-only moderation controls for the unified series page — the same
// actions that used to live only on /admin/series/[seriesId]. Approve is
// available from any non-approved state, not just pending_review, so an
// admin can publish a manga directly without waiting on the creator to
// submit (or resubmit after a rejection) first.
export default function SeriesModeration({ seriesId, moderationStatus }) {
  const router = useRouter();
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

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

  function closeDelete() {
    if (isPending) return;
    setDeleteOpen(false);
  }

  function confirmDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteSeriesAction(seriesId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push('/admin/manga');
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
          {moderationStatus !== 'approved' && (
            <Button size="sm" disabled={isPending} onClick={() => run(approveSeriesAction)}>
              Approve
            </Button>
          )}
          {moderationStatus !== 'approved' && moderationStatus !== 'rejected' && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setShowRejectForm((v) => !v)}
            >
              Reject
            </Button>
          )}
          {moderationStatus === 'approved' && (
            <Button size="sm" variant="outline" disabled={isPending} onClick={() => run(delistSeriesAction)}>
              Delist
            </Button>
          )}
          <Button size="sm" variant="destructive" disabled={isPending} onClick={() => setDeleteOpen(true)}>
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

      <Dialog open={deleteOpen} onClose={closeDelete} title="Delete series?">
        <p className="text-sm text-muted-foreground">
          This permanently deletes the series and all its chapters. This cannot be undone.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={isPending} onClick={closeDelete}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={confirmDelete}>
            {isPending ? 'Deleting…' : 'Delete series'}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}
