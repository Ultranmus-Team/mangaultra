'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BookmarkPlus, BookmarkCheck, Settings2 } from 'lucide-react';
import { followSeriesAction, unfollowSeriesAction } from '@/app/series/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Dialog from '@/components/ui/dialog';

// One-click follow (no threshold) via the main button; the gear opens a
// small dialog to set/edit "only notify me once chapter reaches #", usable
// whether or not the reader is following yet.
export default function FollowSeriesButton({ seriesId, initialFollowing, initialMinChapter }) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [minChapter, setMinChapter] = useState(initialMinChapter ?? '');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  function quickFollow() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const result = next ? await followSeriesAction(seriesId, null) : await unfollowSeriesAction(seriesId);
      if (result?.error) {
        setFollowing(!next);
        return;
      }
      if (next) setMinChapter('');
      router.refresh();
    });
  }

  function close() {
    if (isPending) return;
    setOpen(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await followSeriesAction(seriesId, minChapter || null);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setFollowing(true);
      setMinChapter(result.minChapter ?? '');
      setOpen(false);
      router.refresh();
    });
  }

  function unfollow() {
    setError(null);
    startTransition(async () => {
      const result = await unfollowSeriesAction(seriesId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setFollowing(false);
      setMinChapter('');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button variant={following ? 'outline' : 'default'} size="sm" disabled={isPending} onClick={quickFollow}>
          {following ? (
            <>
              <BookmarkCheck className="mr-1.5 h-4 w-4" />
              Following
            </>
          ) : (
            <>
              <BookmarkPlus className="mr-1.5 h-4 w-4" />
              Follow
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Follow settings"
          onClick={() => setOpen(true)}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={open} onClose={close} title="Follow settings">
        <p className="text-sm text-muted-foreground">
          Leave this blank to be notified about every new chapter, or set a chapter number to only be notified once
          the series reaches it.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="min-chapter">Only notify me once chapter reaches</Label>
          <Input
            id="min-chapter"
            type="number"
            min="0.1"
            step="0.1"
            placeholder="e.g. 20 (optional)"
            value={minChapter}
            onChange={(e) => setMinChapter(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          {following && (
            <Button variant="destructive" disabled={isPending} onClick={unfollow}>
              Unfollow
            </Button>
          )}
          <Button variant="ghost" disabled={isPending} onClick={close}>
            Cancel
          </Button>
          <Button disabled={isPending} onClick={save}>
            {isPending ? 'Saving…' : following ? 'Update' : 'Follow'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
