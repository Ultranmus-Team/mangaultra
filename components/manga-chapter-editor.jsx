'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, ArrowDown, X, ImagePlus } from 'lucide-react';
import { addMangaChapterAction, updateMangaChapterAction } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

let nextId = 1;

export default function MangaChapterEditor({ seriesId, seriesSlug, initialChapter }) {
  const router = useRouter();
  const isEditing = Boolean(initialChapter);
  const fileInputRef = useRef(null);
  const dragIndexRef = useRef(null);

  const [step, setStep] = useState('edit');
  const [chapterNumber, setChapterNumber] = useState(initialChapter?.chapterNumber?.toString() ?? '');
  const [title, setTitle] = useState(initialChapter?.title ?? '');
  const [pages, setPages] = useState(() =>
    (initialChapter?.pages ?? []).map((p) => ({
      id: nextId++,
      kind: 'existing',
      storagePath: p.storagePath,
      url: p.url,
    }))
  );
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);

  useEffect(() => {
    // Revoke object URLs on unmount so we don't leak memory.
    return () => pages.forEach((p) => p.kind === 'new' && URL.revokeObjectURL(p.previewUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    const newPages = files.map((file) => ({
      id: nextId++,
      kind: 'new',
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPages((prev) => [...prev, ...newPages]);
  }

  function removePage(id) {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.kind === 'new') URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  function movePage(index, direction) {
    setPages((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleDragStart(index) {
    dragIndexRef.current = index;
    setDraggingIndex(index);
  }

  function handleDragOverSlot(index) {
    if (dragIndexRef.current === null || dragIndexRef.current === index) {
      setDropTargetIndex(null);
      return;
    }
    setDropTargetIndex(index);
  }

  function handleDrop(index) {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setDropTargetIndex(null);
    if (from === null || from === index) return;
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    setDraggingIndex(null);
    setDropTargetIndex(null);
  }

  function goToPreview() {
    setError(null);
    if (!chapterNumber) {
      setError('Chapter number is required.');
      return;
    }
    if (pages.length === 0) {
      setError('At least one page image is required.');
      return;
    }
    setStep('preview');
  }

  function publish() {
    setError(null);
    const formData = new FormData();
    formData.set('chapterNumber', chapterNumber);
    formData.set('title', title);

    if (isEditing) {
      const manifest = pages.map((p) =>
        p.kind === 'existing' ? { type: 'existing', storagePath: p.storagePath } : { type: 'new' }
      );
      formData.set('manifest', JSON.stringify(manifest));
      pages.filter((p) => p.kind === 'new').forEach((p) => formData.append('newFiles', p.file));
    } else {
      pages.forEach((p) => formData.append('pages', p.file));
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateMangaChapterAction(seriesId, initialChapter.id, null, formData)
        : await addMangaChapterAction(seriesId, null, formData);
      if (result?.error) {
        setError(result.error);
        setStep('edit');
        return;
      }
      router.push(`/series/${seriesSlug}/chapter/${chapterNumber}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className={cn(step !== 'edit' && 'hidden')} aria-hidden={step !== 'edit'}>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="chapterNumber">Chapter number</Label>
            <Input
              id="chapterNumber"
              type="number"
              step="0.1"
              min="0"
              value={chapterNumber}
              onChange={(e) => setChapterNumber(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="title">Title (optional)</Label>
            <Input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Label>Page images</Label>
          {isEditing && (
            <p className="text-xs text-muted-foreground">
              Existing pages are shown below — remove or reorder them, or add new ones.
            </p>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed py-10 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-accent"
          >
            <ImagePlus className="h-6 w-6" />
            Click or drag images here — add in any order, then drag thumbnails below to reorder.
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />

          {pages.length > 0 && (
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3 md:grid-cols-4">
              {pages.map((p, index) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    handleDragOverSlot(index);
                  }}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    'group relative cursor-grab overflow-hidden rounded-md border bg-muted transition-all active:cursor-grabbing',
                    draggingIndex === index && 'opacity-40',
                    dropTargetIndex === index && draggingIndex !== index && 'ring-2 ring-primary ring-offset-2'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.kind === 'existing' ? p.url : p.previewUrl}
                    alt={`Page ${index + 1}`}
                    className="aspect-[2/3] w-full object-cover"
                  />
                  <span className="absolute left-1.5 top-1.5 rounded bg-background/90 px-1.5 py-0.5 text-xs font-medium">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePage(p.id)}
                    aria-label="Remove page"
                    className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => movePage(index, -1)}
                      disabled={index === 0}
                      aria-label="Move earlier"
                      className="rounded-full bg-background/90 p-1 disabled:opacity-40"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePage(index, 1)}
                      disabled={index === pages.length - 1}
                      aria-label="Move later"
                      className="rounded-full bg-background/90 p-1 disabled:opacity-40"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4">
          <Button onClick={goToPreview}>Preview</Button>
        </div>
      </div>

      {step === 'preview' && (
        <div className="space-y-6">
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            This is exactly how readers will see it. Go back to reorder or add pages, or {isEditing ? 'save' : 'publish'}.
          </div>
          <div className="mx-auto max-w-2xl space-y-4 rounded-md border p-6">
            <h1 className="text-2xl font-semibold">
              Chapter {chapterNumber}
              {title ? ` — ${title}` : ''}
            </h1>
            <div className="flex flex-col gap-2">
              {pages.map((p, index) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.id}
                  src={p.kind === 'existing' ? p.url : p.previewUrl}
                  alt={`Page ${index + 1}`}
                  className="w-full rounded-md border"
                />
              ))}
            </div>
          </div>
          <div className="mx-auto flex max-w-2xl gap-2">
            <Button variant="outline" disabled={isPending} onClick={() => setStep('edit')}>
              Back to edit
            </Button>
            <Button disabled={isPending} onClick={publish}>
              {isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Confirm & publish'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
