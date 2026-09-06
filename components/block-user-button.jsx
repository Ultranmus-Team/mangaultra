'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { blockUserAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Dialog from '@/components/ui/dialog';

export default function BlockUserButton({ userId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [hidePublished, setHidePublished] = useState(false);
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    if (isPending) return;
    setOpen(false);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await blockUserAction(userId, reason, hidePublished);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        Block user
      </Button>

      <Dialog open={open} onClose={close} title="Block user">
        <p className="text-sm text-muted-foreground">
          They won't be able to create new series, chapters, or comments. The reason is shown to them.
        </p>
        <Textarea
          placeholder="Reason for blocking"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          autoFocus
        />
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={hidePublished}
            onChange={(e) => setHidePublished(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input"
          />
          Also hide their currently published manga from the public
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={isPending} onClick={close}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={confirm}>
            {isPending ? 'Blocking…' : 'Block user'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
