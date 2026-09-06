'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { unblockUserAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import Dialog from '@/components/ui/dialog';

export default function UnblockUserButton({ userId }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    if (isPending) return;
    setOpen(false);
  }

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await unblockUserAction(userId);
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
      <Button variant="outline" onClick={() => setOpen(true)}>
        Unblock user
      </Button>

      <Dialog open={open} onClose={close} title="Unblock user?">
        <p className="text-sm text-muted-foreground">
          They'll be able to create series, chapters, and comments again. This doesn't restore any manga that was
          delisted when they were blocked — do that separately if needed.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={isPending} onClick={close}>
            Cancel
          </Button>
          <Button disabled={isPending} onClick={confirm}>
            {isPending ? 'Unblocking…' : 'Unblock user'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
