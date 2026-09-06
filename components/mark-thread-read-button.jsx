'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MailOpen } from 'lucide-react';
import { markThreadReadAction } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';

// Shown whenever a thread is unread. Used both as a manual button (inside
// ThreadRow's full-row <Link>, hence the stopPropagation) and, via
// `autoFire`, as the invisible trigger that marks a thread read the moment
// its dedicated page is opened — done through this Server Action (not
// during the page's own render) specifically so it's allowed to call
// revalidatePath for the pages that show this thread's unread state
// elsewhere (the inline preview, the inbox lists).
export default function MarkThreadReadButton({
  threadType,
  threadId,
  extraPaths = [],
  className,
  variant = 'ghost',
  size = 'sm',
  autoFire = false,
  onSuccess,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fired = useRef(false);

  function markRead(e) {
    e?.preventDefault();
    e?.stopPropagation();
    startTransition(async () => {
      const result = await markThreadReadAction(threadType, threadId, extraPaths);
      if (!result?.error) onSuccess?.();
      router.refresh();
    });
  }

  useEffect(() => {
    if (autoFire && !fired.current) {
      fired.current = true;
      markRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (autoFire) return null;

  return (
    <Button type="button" variant={variant} size={size} disabled={isPending} onClick={markRead} className={className}>
      <MailOpen className="mr-1.5 h-3.5 w-3.5" />
      {isPending ? 'Marking…' : 'Mark as read'}
    </Button>
  );
}
