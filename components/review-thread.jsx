'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import CoverPlaceholder from '@/components/cover-placeholder';

// Generic moderation-thread UI shared by the chapter- and series-level
// review threads — reject/approve/resubmit notes logged automatically by
// their actions, plus free-form text/image messages either side can add.
// Only the send action and the kind labels differ between the two.
export default function ReviewThread({ messages, kindLabels, onSend }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [body, setBody] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

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
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h2 className="text-sm font-medium">Review notes</h2>

      {messages.length > 0 && (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className="flex gap-2.5">
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
                    <span className="rounded-full border px-2 py-0.5 text-[11px]">{kindLabels[m.kind]}</span>
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
          ))}
        </div>
      )}

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
