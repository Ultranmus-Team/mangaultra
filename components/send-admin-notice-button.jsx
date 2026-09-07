'use client';

import { useState, useTransition } from 'react';
import { Megaphone } from 'lucide-react';
import { sendAdminNoticeAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Dialog from '@/components/ui/dialog';

// A one-off notice sent straight to this user's notification feed —
// independent of the account block thread below it on this page.
export default function SendAdminNoticeButton({ userId }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function close() {
    if (isPending) return;
    setOpen(false);
    setSent(false);
  }

  function send() {
    setError(null);
    if (!body.trim()) {
      setError('Write something to send.');
      return;
    }
    const formData = new FormData();
    formData.set('body', body);

    startTransition(async () => {
      const result = await sendAdminNoticeAction(userId, null, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setBody('');
      setSent(true);
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Megaphone className="mr-1.5 h-4 w-4" />
        Send notification
      </Button>

      <Dialog open={open} onClose={close} title="Send notification">
        <p className="text-sm text-muted-foreground">
          Sent directly to this user's notification feed — not part of their account thread.
        </p>
        <Textarea
          placeholder="Message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {sent && <p className="text-sm text-primary">Sent.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={isPending} onClick={close}>
            Close
          </Button>
          <Button disabled={isPending} onClick={send}>
            {isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
