'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MoreVertical } from 'lucide-react';
import { setChapterVisibilityAction, deleteChapterAction, resubmitChapterAction } from '@/app/dashboard/actions';
import { rejectChapterAction, approveChapterAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Dialog from '@/components/ui/dialog';

// Same menu, same options, wherever a chapter shows up for its owner or an
// admin — the chapter row in the series page, and the top of the chapter's
// own reading page. Delete/Reject/Approve/Resubmit each open a centered
// dialog instead of cramming a confirm or a reason box into the dropdown.
export default function ChapterMenu({ seriesId, seriesSlug, chapterId, chapterNumber, status, isOwner, isAdmin }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null); // 'delete' | 'reject' | 'approve' | 'resubmit' | null
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();
  const ref = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function openDialog(name) {
    setOpen(false);
    setError(null);
    setNote('');
    setDialog(name);
  }

  function closeDialog() {
    if (isPending) return;
    setDialog(null);
  }

  function toggleVisibility() {
    setOpen(false);
    startTransition(async () => {
      await setChapterVisibilityAction(seriesId, chapterId, status !== 'hidden');
      router.refresh();
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteChapterAction(seriesId, chapterId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDialog(null);
      router.push(`/series/${seriesSlug}`);
      router.refresh();
    });
  }

  function confirmReject() {
    setError(null);
    startTransition(async () => {
      const result = await rejectChapterAction(seriesId, chapterId, note);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDialog(null);
      router.refresh();
    });
  }

  function confirmApprove() {
    setError(null);
    startTransition(async () => {
      const result = await approveChapterAction(seriesId, chapterId, note);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDialog(null);
      router.refresh();
    });
  }

  function confirmResubmit() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set('body', note);
      const result = await resubmitChapterAction(seriesId, chapterId, null, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setDialog(null);
      router.refresh();
    });
  }

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Chapter options"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 w-48 pt-1">
          <div className="rounded-md border bg-background py-1 shadow-md">
            <Link
              href={`/series/${seriesSlug}/chapter/${chapterNumber}/edit`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              Edit
            </Link>

            {(status === 'published' || status === 'hidden') && (
              <button
                type="button"
                onClick={toggleVisibility}
                className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                {status === 'hidden' ? 'Unhide' : 'Hide'}
              </button>
            )}

            {isOwner && status === 'rejected' && (
              <button
                type="button"
                onClick={() => openDialog('resubmit')}
                className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                Resubmit for review
              </button>
            )}

            {isAdmin && status !== 'rejected' && (
              <button
                type="button"
                onClick={() => openDialog('reject')}
                className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                Reject
              </button>
            )}

            {isAdmin && (status === 'rejected' || status === 'pending_review') && (
              <button
                type="button"
                onClick={() => openDialog('approve')}
                className="block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                Approve
              </button>
            )}

            <button
              type="button"
              onClick={() => openDialog('delete')}
              className="block w-full border-t px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-accent"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      <Dialog open={dialog === 'delete'} onClose={closeDialog} title="Delete chapter?">
        <p className="text-sm text-muted-foreground">
          This permanently deletes Chapter {chapterNumber} and all its content. This cannot be undone.
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={isPending} onClick={closeDialog}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={confirmDelete}>
            {isPending ? 'Deleting…' : 'Delete chapter'}
          </Button>
        </div>
      </Dialog>

      <Dialog open={dialog === 'reject'} onClose={closeDialog} title="Reject chapter">
        <p className="text-sm text-muted-foreground">
          This hides Chapter {chapterNumber} from readers. The reason is shown to the author.
        </p>
        <Textarea
          placeholder="Reason for rejection"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={isPending} onClick={closeDialog}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isPending} onClick={confirmReject}>
            {isPending ? 'Rejecting…' : 'Reject chapter'}
          </Button>
        </div>
      </Dialog>

      <Dialog open={dialog === 'approve'} onClose={closeDialog} title="Approve chapter">
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
          <Button variant="ghost" disabled={isPending} onClick={closeDialog}>
            Cancel
          </Button>
          <Button disabled={isPending} onClick={confirmApprove}>
            {isPending ? 'Approving…' : 'Approve chapter'}
          </Button>
        </div>
      </Dialog>

      <Dialog open={dialog === 'resubmit'} onClose={closeDialog} title="Resubmit for review">
        <p className="text-sm text-muted-foreground">
          Sends Chapter {chapterNumber} back to an admin for another look.
        </p>
        <Textarea
          placeholder="What did you change? (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={isPending} onClick={closeDialog}>
            Cancel
          </Button>
          <Button disabled={isPending} onClick={confirmResubmit}>
            {isPending ? 'Resubmitting…' : 'Resubmit'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
