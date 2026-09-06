'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered, Quote } from 'lucide-react';
import { addNovelChapterAction, updateNovelChapterAction } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

function ToolbarButton({ active, onClick, children, label }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
        active && 'bg-accent text-foreground'
      )}
    >
      {children}
    </button>
  );
}

// Block-level formats (headings, blockquote, bullet list, numbered list)
// are mutually exclusive — a paragraph is only ever one of them at a time.
// Trying to detect "what's currently active" and toggle just that one off
// (the previous approach) falls apart across a large, multi-paragraph
// selection that isn't uniformly in one state — e.g. after a few earlier
// format changes, `isActive('blockquote')` can come back false even though
// some paragraphs in the selection are still blockquotes, so nothing gets
// cleared and the new format ends up nested inside the old one instead of
// replacing it. The reliable fix is to not depend on that detection at
// all: unconditionally reset the whole selection to plain paragraphs with
// Tiptap's built-in `clearNodes`, then apply the target format fresh. That
// works the same way regardless of how messy the prior state was.
function isBlockFormatActive(editor, format) {
  if (format === 'h2') return editor.isActive('heading', { level: 2 });
  if (format === 'h3') return editor.isActive('heading', { level: 3 });
  return editor.isActive(format);
}

function applyBlockFormat(editor, target) {
  const wasActive = isBlockFormatActive(editor, target);

  editor.chain().focus().clearNodes().run();

  // Clicking the already-active format just clears it — that's "toggle off".
  if (wasActive) return;

  const chain = editor.chain().focus();
  switch (target) {
    case 'h2':
      chain.setHeading({ level: 2 });
      break;
    case 'h3':
      chain.setHeading({ level: 3 });
      break;
    case 'bulletList':
      chain.toggleBulletList();
      break;
    case 'orderedList':
      chain.toggleOrderedList();
      break;
    case 'blockquote':
      chain.setBlockquote();
      break;
  }
  chain.run();
}

function EditorToolbar({ editor }) {
  if (!editor) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 border-b p-2">
      <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => applyBlockFormat(editor, 'h2')}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => applyBlockFormat(editor, 'h3')}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <div className="mx-1 h-5 w-px bg-border" />
      <ToolbarButton
        label="Bullet list"
        active={editor.isActive('bulletList')}
        onClick={() => applyBlockFormat(editor, 'bulletList')}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive('orderedList')}
        onClick={() => applyBlockFormat(editor, 'orderedList')}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Quote"
        active={editor.isActive('blockquote')}
        onClick={() => applyBlockFormat(editor, 'blockquote')}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export default function NovelChapterEditor({ seriesId, seriesSlug, initialChapter }) {
  const router = useRouter();
  const isEditing = Boolean(initialChapter);
  const [step, setStep] = useState('edit');
  const [chapterNumber, setChapterNumber] = useState(initialChapter?.chapterNumber?.toString() ?? '');
  const [title, setTitle] = useState(initialChapter?.title ?? '');
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialChapter?.body || '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-neutral max-w-none min-h-[420px] px-4 py-4 focus:outline-none',
      },
    },
  });

  function goToPreview() {
    setError(null);
    if (!chapterNumber) {
      setError('Chapter number is required.');
      return;
    }
    if (!editor || editor.isEmpty) {
      setError('Chapter text is required.');
      return;
    }
    setStep('preview');
  }

  function publish() {
    setError(null);
    const formData = new FormData();
    formData.set('chapterNumber', chapterNumber);
    formData.set('title', title);
    formData.set('body', editor.getHTML());

    startTransition(async () => {
      const result = isEditing
        ? await updateNovelChapterAction(seriesId, initialChapter.id, null, formData)
        : await addNovelChapterAction(seriesId, null, formData);
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
          <Label>Chapter text</Label>
          <div className="rounded-md border">
            <EditorToolbar editor={editor} />
            <EditorContent editor={editor} />
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={goToPreview}>Preview</Button>
        </div>
      </div>

      {step === 'preview' && (
        <div className="space-y-6">
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            This is exactly how readers will see it. Go back to keep editing, or {isEditing ? 'save' : 'publish'}.
          </div>
          <article className="prose prose-neutral max-w-none rounded-md border p-6">
            <h1 className="mb-0">
              Chapter {chapterNumber}
              {title ? ` — ${title}` : ''}
            </h1>
            <div dangerouslySetInnerHTML={{ __html: editor?.getHTML() || '' }} />
          </article>
          <div className="flex gap-2">
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
