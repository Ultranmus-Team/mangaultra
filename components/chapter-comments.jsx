'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { ImagePlus, X } from 'lucide-react';
import {
  addChapterCommentAction,
  deleteChapterCommentAction,
  getChapterCommentsAction,
  getChapterCommentRepliesAction,
} from '@/app/series/actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import CoverPlaceholder from '@/components/cover-placeholder';
import Dialog from '@/components/ui/dialog';
import { formatRelativeTime } from '@/lib/util';

function Avatar({ username, avatarUrl, className }) {
  return avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={avatarUrl} alt={username} className={className} />
  ) : (
    <CoverPlaceholder title={username} className={className} />
  );
}

function Composer({ chapterId, parentId, placeholder, autoFocus, onPosted }) {
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

  function submit() {
    setError(null);
    if (!body.trim() && !imageFile) {
      setError('Write something or attach an image.');
      return;
    }
    const formData = new FormData();
    formData.set('body', body);
    if (imageFile) formData.set('image', imageFile);

    startTransition(async () => {
      const result = await addChapterCommentAction(chapterId, parentId, null, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setBody('');
      clearImage();
      onPosted?.();
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        placeholder={placeholder}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        autoFocus={autoFocus}
      />
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
          Photo
        </Button>
        <Button type="button" size="sm" disabled={isPending} onClick={submit}>
          {isPending ? 'Posting…' : 'Post'}
        </Button>
      </div>
    </div>
  );
}

function DeleteCommentButton({ chapterId, commentId, onDeleted }) {
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
      const result = await deleteChapterCommentAction(chapterId, commentId);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      onDeleted?.();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="hover:text-destructive">
        Delete
      </button>
      <Dialog open={open} onClose={close} title="Delete comment?">
        <p className="text-sm text-muted-foreground">This permanently removes this comment.</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={isPending} onClick={close}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" disabled={isPending} onClick={confirm}>
            {isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function CommentBody({ comment, canDelete, chapterId, onDeleted, actions }) {
  return (
    <div className="flex gap-2.5">
      <Avatar
        username={comment.author_username}
        avatarUrl={comment.author_avatar_url}
        className="h-8 w-8 shrink-0 rounded-full border object-cover"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {comment.isAdminIdentity ? (
            <span className="font-medium text-foreground">{comment.author_username}</span>
          ) : (
            <Link href={`/u/${comment.author_username}`} className="font-medium text-foreground hover:underline">
              {comment.author_username}
            </Link>
          )}
          <span>{formatRelativeTime(comment.created_at)}</span>
        </div>
        {comment.body && <p className="whitespace-pre-wrap text-sm">{comment.body}</p>}
        {comment.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.image_url} alt="Attachment" className="mt-1 max-w-[280px] rounded-md border" />
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {actions}
          {canDelete && <DeleteCommentButton chapterId={chapterId} commentId={comment.id} onDeleted={onDeleted} />}
        </div>
      </div>
    </div>
  );
}

// Replies are collapsed by default — only a top-level comment's own reply
// count is fetched up front — so a long thread doesn't bury the direct
// comments a reader came to read. Loading and paging replies both happen
// lazily, per top-level comment.
function CommentThreadItem({ comment, chapterId, currentUserId, isAdmin, isLoggedIn, onDeleted, onTotalDelta }) {
  const [replying, setReplying] = useState(false);
  const [replies, setReplies] = useState([]);
  const [repliesShown, setRepliesShown] = useState(false);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [replyCount, setReplyCount] = useState(comment.reply_count);
  const [hasMoreReplies, setHasMoreReplies] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canDelete = Boolean(currentUserId) && (currentUserId === comment.author_id || isAdmin);

  function loadReplies() {
    startTransition(async () => {
      const result = await getChapterCommentRepliesAction(chapterId, comment.id, 0);
      setReplies(result.replies);
      setHasMoreReplies(result.hasMore);
      setRepliesLoaded(true);
      setRepliesShown(true);
    });
  }

  function loadMoreReplies() {
    startTransition(async () => {
      const result = await getChapterCommentRepliesAction(chapterId, comment.id, replies.length);
      setReplies((prev) => [...prev, ...result.replies]);
      setHasMoreReplies(result.hasMore);
    });
  }

  function onReplyPosted() {
    setReplying(false);
    setReplyCount((c) => c + 1);
    onTotalDelta(1);
    if (repliesLoaded) {
      // Re-fetch from the start so the new reply appears in its place.
      startTransition(async () => {
        const result = await getChapterCommentRepliesAction(chapterId, comment.id, 0);
        setReplies(result.replies);
        setHasMoreReplies(result.hasMore);
        setRepliesShown(true);
      });
    } else {
      loadReplies();
    }
  }

  function onReplyDeleted(replyId) {
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
    setReplyCount((c) => Math.max(0, c - 1));
    onTotalDelta(-1);
  }

  return (
    <div className="space-y-2">
      <CommentBody
        comment={comment}
        canDelete={canDelete}
        chapterId={chapterId}
        onDeleted={() => onDeleted(comment.id, replyCount)}
        actions={
          isLoggedIn && (
            <button type="button" onClick={() => setReplying((v) => !v)} className="font-medium hover:text-foreground">
              Reply
            </button>
          )
        }
      />

      {replying && (
        <div className="ml-10 pl-4">
          <Composer
            chapterId={chapterId}
            parentId={comment.id}
            placeholder={`Reply to ${comment.author_username}…`}
            autoFocus
            onPosted={onReplyPosted}
          />
        </div>
      )}

      {replyCount > 0 && !repliesShown && (
        <button
          type="button"
          disabled={isPending}
          onClick={loadReplies}
          className="ml-10 pl-4 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {isPending ? 'Loading…' : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
        </button>
      )}

      {repliesShown && (
        <div className="ml-10 space-y-3 border-l pl-4">
          {replies.map((reply) => (
            <CommentBody
              key={reply.id}
              comment={reply}
              canDelete={Boolean(currentUserId) && (currentUserId === reply.author_id || isAdmin)}
              chapterId={chapterId}
              onDeleted={() => onReplyDeleted(reply.id)}
            />
          ))}
          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            {hasMoreReplies && (
              <button type="button" disabled={isPending} onClick={loadMoreReplies} className="hover:text-foreground">
                {isPending ? 'Loading…' : 'Load more replies'}
              </button>
            )}
            <button type="button" onClick={() => setRepliesShown(false)} className="hover:text-foreground">
              Hide replies
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChapterComments({ chapterId, initialComments, initialTotal, initialHasMore, currentUserId, isAdmin, isLoggedIn }) {
  const [comments, setComments] = useState(initialComments);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    startTransition(async () => {
      const result = await getChapterCommentsAction(chapterId, comments.length);
      setComments((prev) => [...prev, ...result.comments]);
      setHasMore(result.hasMore);
      setTotal(result.total);
    });
  }

  function onPosted() {
    // A new top-level comment sorts to the front (newest first) — simplest
    // correct thing is to re-fetch page one rather than guess its shape.
    startTransition(async () => {
      const result = await getChapterCommentsAction(chapterId, 0);
      setComments(result.comments);
      setHasMore(result.hasMore);
      setTotal(result.total);
    });
  }

  function onCommentDeleted(commentId, deletedReplyCount) {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    setTotal((t) => Math.max(0, t - 1 - deletedReplyCount));
  }

  function onTotalDelta(delta) {
    setTotal((t) => Math.max(0, t + delta));
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">Comments{total > 0 ? ` (${total})` : ''}</h2>

      {isLoggedIn ? (
        <Composer chapterId={chapterId} parentId={null} placeholder="Add a comment…" onPosted={onPosted} />
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="underline">
            Log in
          </Link>{' '}
          to join the conversation.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Be the first to say something.</p>
      ) : (
        <div className="space-y-5">
          {comments.map((comment) => (
            <CommentThreadItem
              key={comment.id}
              comment={comment}
              chapterId={chapterId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              isLoggedIn={isLoggedIn}
              onDeleted={onCommentDeleted}
              onTotalDelta={onTotalDelta}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={loadMore}>
            {isPending ? 'Loading…' : 'Load more comments'}
          </Button>
        </div>
      )}
    </div>
  );
}
