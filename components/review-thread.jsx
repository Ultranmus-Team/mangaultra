'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import CoverPlaceholder from '@/components/cover-placeholder';
import MarkThreadReadButton from '@/components/mark-thread-read-button';

const OLDER_CHUNK = 20;

// Generic moderation-thread UI shared by the chapter- and series-level
// review threads — reject/approve/resubmit notes logged automatically by
// their actions, plus free-form text/image messages either side can add.
// Only the send action and the kind labels differ between the two.
//
// Messages load like a chat app, not a paged list: `messages` is the
// initial window (already positioned around the first unread message, or
// the tail of the thread if everything's read) and `initialOffset` is how
// many older messages exist before it. Scrolling to the top of the pane
// fetches the next chunk via `onLoadOlder(offset, limit)` and prepends it,
// preserving scroll position — reverse infinite scroll, WhatsApp-style.
// `unread` (optional) is { isUnread, lastReadAt, threadType, threadId,
// extraPaths } — lastReadAt (or null, meaning never read) positions the
// "New" divider before the first message that postdates it.
export default function ReviewThread({
  messages: initialMessages,
  kindLabels,
  onSend,
  onLoadOlder,
  initialOffset = 0,
  unread,
}) {
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const dividerRef = useRef(null);
  const bottomRef = useRef(null);
  const didInitialScroll = useRef(false);

  const [body, setBody] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  // Frozen at mount — the point of infinite scroll is that opening the
  // thread and reading it doesn't get disturbed by unrelated re-renders
  // (e.g. the auto mark-as-read refresh) recomputing where we should be.
  const [messages, setMessages] = useState(initialMessages);
  const [remainingOlder, setRemainingOlder] = useState(initialOffset);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Also frozen at mount, same reasoning, and for the same WhatsApp-like
  // reason: opening an unread thread quietly marks it read in the
  // background (autoFire below), but the "New" divider and the read
  // affordance should stay exactly as they were for this viewing session —
  // they shouldn't vanish and reflow the layout under you mid-read. An
  // explicit click on the manual button is different: that's a user
  // action, so it updates this snapshot immediately via onSuccess.
  const [unreadView, setUnreadView] = useState(unread);

  function onPickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function send() {
    setError(null);
    if (!body.trim() && !imageFile) {
      setError('Write a message or attach an image.');
      return;
    }
    const formData = new FormData();
    formData.set('body', body);
    if (imageFile) formData.set('image', imageFile);

    startTransition(async () => {
      const result = await onSend(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setBody('');
      clearImage();
      if (result?.message) {
        setMessages((prev) => [...prev, result.message]);
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ block: 'end' });
        });
      }
    });
  }

  async function loadOlder() {
    if (loadingOlder || remainingOlder <= 0 || !onLoadOlder) return;
    // Measured before the loading indicator even mounts, not after — it
    // has height too, and compensating only for the message prepend while
    // ignoring the indicator's own insertion is what caused the visible
    // shift when a scroll-triggered load kicked in.
    const container = scrollRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;
    setLoadingOlder(true);
    setLoadError(null);
    const chunk = Math.min(OLDER_CHUNK, remainingOlder);
    const offset = remainingOlder - chunk;
    const result = await onLoadOlder(offset, chunk);
    if (result?.error) {
      setLoadError(result.error);
      setLoadingOlder(false);
      return;
    }
    setMessages((prev) => [...(result.messages || []), ...prev]);
    setRemainingOlder(offset);
    setLoadingOlder(false);
    requestAnimationFrame(() => {
      if (container) {
        container.scrollTop = prevScrollTop + (container.scrollHeight - prevScrollHeight);
      }
    });
  }

  // Land on first open the way a chat app does: scrolled to the unread
  // divider if there's anything unread, otherwise scrolled to the bottom.
  useEffect(() => {
    if (didInitialScroll.current) return;
    didInitialScroll.current = true;
    if (dividerRef.current) {
      dividerRef.current.scrollIntoView({ block: 'center' });
    } else {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse infinite scroll: a sentinel just above the message list
  // triggers the next older chunk once it enters the viewport.
  useEffect(() => {
    const container = scrollRef.current;
    const sentinel = container?.querySelector('[data-older-sentinel]');
    if (!container || !sentinel) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadOlder();
      },
      { root: container, threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingOlder, loadingOlder]);

  const lastReadTime = unreadView?.lastReadAt ? new Date(unreadView.lastReadAt).getTime() : 0;
  let dividerShown = false;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Review notes</h2>
        {unreadView?.isUnread && (
          <>
            <MarkThreadReadButton
              threadType={unreadView.threadType}
              threadId={unreadView.threadId}
              extraPaths={unreadView.extraPaths}
              onSuccess={() => setUnreadView((prev) => ({ ...prev, isUnread: false }))}
            />
            <MarkThreadReadButton
              threadType={unreadView.threadType}
              threadId={unreadView.threadId}
              extraPaths={unreadView.extraPaths}
              autoFire
            />
          </>
        )}
      </div>

      <div ref={scrollRef} className="max-h-[65vh] overflow-y-auto">
        <div data-older-sentinel />

        {/* Fixed height regardless of which state below is showing, so
            starting/finishing a background load never shifts the messages
            beneath it — the same "don't reflow under the reader" rule as
            the frozen unread snapshot above. */}
        <div className="mb-2 flex h-5 items-center justify-center text-center text-xs text-muted-foreground">
          {loadingOlder && <span>Loading older messages…</span>}
          {!loadingOlder && !loadError && remainingOlder === 0 && messages.length > 0 && (
            <span>Start of conversation</span>
          )}
        </div>
        {loadError && (
          <div className="mb-2 flex items-center justify-center gap-2 text-center text-xs text-destructive">
            <span>Couldn't load older messages.</span>
            <Button type="button" variant="outline" size="sm" onClick={loadOlder}>
              Retry
            </Button>
          </div>
        )}

        {messages.length > 0 && (
          <div className="space-y-3">
            {messages.map((m) => {
              let showDivider = false;
              if (unreadView?.isUnread && !dividerShown && new Date(m.created_at).getTime() > lastReadTime) {
                showDivider = true;
                dividerShown = true;
              }
              return (
                <div key={m.id}>
                  {showDivider && (
                    <div
                      ref={dividerRef}
                      className="mb-3 flex items-center gap-2 text-xs font-medium text-primary"
                    >
                      <div className="h-px flex-1 bg-primary/30" />
                      New
                      <div className="h-px flex-1 bg-primary/30" />
                    </div>
                  )}
                  <div className="flex gap-2.5">
                    {m.sender_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.sender_avatar_url}
                        alt={m.sender_username}
                        className="h-8 w-8 shrink-0 rounded-full border object-cover"
                      />
                    ) : (
                      <CoverPlaceholder title={m.sender_username} className="h-8 w-8 shrink-0 rounded-full border" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{m.sender_username}</span>
                        {kindLabels[m.kind] && (
                          <Badge variant={kindLabels[m.kind].variant}>{kindLabels[m.kind].label}</Badge>
                        )}
                        <span>
                          {new Date(m.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {m.body && <p className="whitespace-pre-wrap text-sm">{m.body}</p>}
                      {m.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.image_url} alt="Attachment" className="mt-1 max-w-[240px] rounded-md border" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="space-y-2 border-t pt-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Textarea placeholder="Write a note…" value={body} onChange={(e) => setBody(e.target.value)} rows={2} />

        {imagePreview && (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Attachment preview" className="h-20 rounded-md border object-cover" />
            <button
              type="button"
              onClick={clearImage}
              aria-label="Remove attachment"
              className="absolute -right-2 -top-2 rounded-full border bg-background p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
            Attach image
          </Button>
          <Button type="button" size="sm" disabled={isPending} onClick={send}>
            {isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
