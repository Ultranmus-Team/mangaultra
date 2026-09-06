'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitForApprovalAction } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Dialog from '@/components/ui/dialog';

// A fresh ('draft') submission just fires — nothing to explain yet. A
// resubmission after a rejection opens a small dialog for an optional note
// so the admin sees what changed, logged into the series' review thread.
export default function SubmitForReviewButton({ seriesId, disabled, isResubmit }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  function submit(body) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      if (body) formData.set('body', body);
      const result = await submitForApprovalAction(seriesId, null, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!isResubmit) {
    return (
      <div className="space-y-2">
        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button disabled={disabled || isPending} onClick={() => submit()}>
          {isPending ? 'Submitting…' : 'Submit for review'}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button disabled={disabled} onClick={() => setOpen(true)}>
        Resubmit for review
      </Button>

      <Dialog open={open} onClose={() => !isPending && setOpen(false)} title="Resubmit for review">
        <p className="text-sm text-muted-foreground">Sends this series back to an admin for another look.</p>
        <Textarea
          placeholder="What did you change? (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={isPending} onClick={() => submit(note)}>
            {isPending ? 'Resubmitting…' : 'Resubmit'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
