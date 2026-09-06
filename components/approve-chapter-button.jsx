'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveChapterAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Dialog from '@/components/ui/dialog';

// Admin-only quick action shown right next to a chapter's rejected/pending
// status so approving it doesn't require opening the "⋮" menu.
export default function ApproveChapterButton({ seriesId, chapterId, chapterNumber, size = 'sm' }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    if (isPending) return;
    setOpen(false);
  }

  function confirmApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveChapterAction(seriesId, chapterId, note);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setNote('');
      router.refresh();
    });
  }

  return (
    <>
      <Button size={size} onClick={() => setOpen(true)}>
        Approve
      </Button>

      <Dialog open={open} onClose={close} title="Approve chapter">
        <p className="text-sm text-muted-foreground">
          This publishes Chapter {chapterNumber} and makes it visible to readers again.
        </p>
        <Textarea
          placeholder="Note to the author (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={isPending} onClick={close}>
            Cancel
          </Button>
          <Button disabled={isPending} onClick={confirmApprove}>
            {isPending ? 'Approving…' : 'Approve chapter'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
