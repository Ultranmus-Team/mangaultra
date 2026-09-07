'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getChapterCommentRepliesAction } from '@/app/series/actions';
import { Button } from '@/components/ui/button';
import { Composer, CommentBody } from '@/components/chapter-comments';

// The focused view a comment_reply/new_comment notification links to — the
// root comment plus its full reply list, one level deep (replies don't
// nest further, same rule as the inline feed in chapter-comments.jsx). Reuses
// that file's Composer/CommentBody rather than re-implementing them.
export default function CommentThread({
  chapterId,
  rootComment,
  initialReplies,
  initialTotal,
  initialHasMore,
  currentUserId,
  isAdmin,
  isLoggedIn,
  chapterHref,
}) {
  const router = useRouter();
  const [rootDeleted, setRootDeleted] = useState(false);
  const [replies, setReplies] = useState(initialReplies);
  const [total, setTotal] = useState(initialTotal);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  const canDeleteRoot = Boolean(currentUserId) && (currentUserId === rootComment.author_id || isAdmin);

  function loadMore() {
    startTransition(async () => {
      const result = await getChapterCommentRepliesAction(chapterId, rootComment.id, replies.length);
      setReplies((prev) => [...prev, ...result.replies]);
      setHasMore(result.hasMore);
    });
  }

  function onReplyPosted() {
    startTransition(async () => {
      const result = await getChapterCommentRepliesAction(chapterId, rootComment.id, 0);
      setReplies(result.replies);
      setTotal(result.total);
      setHasMore(result.hasMore);
    });
  }

  function onReplyDeleted(replyId) {
    setReplies((prev) => prev.filter((r) => r.id !== replyId));
    setTotal((t) => Math.max(0, t - 1));
  }

  function onRootDeleted() {
    setRootDeleted(true);
    router.push(chapterHref);
  }

  if (rootDeleted) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-medium">Comment{total > 0 ? ` · ${total} ${total === 1 ? 'reply' : 'replies'}` : ''}</h2>

      <CommentBody comment={rootComment} canDelete={canDeleteRoot} chapterId={chapterId} onDeleted={onRootDeleted} />

      {replies.length > 0 && (
        <div className="ml-10 space-y-4 border-l pl-4">
          {replies.map((reply) => (
            <CommentBody
              key={reply.id}
              comment={reply}
              canDelete={Boolean(currentUserId) && (currentUserId === reply.author_id || isAdmin)}
              chapterId={chapterId}
              onDeleted={() => onReplyDeleted(reply.id)}
            />
          ))}
          {hasMore && (
            <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={loadMore}>
              {isPending ? 'Loading…' : 'Load more replies'}
            </Button>
          )}
        </div>
      )}

      <div className="border-t pt-4">
        {isLoggedIn ? (
          <Composer
            chapterId={chapterId}
            parentId={rootComment.id}
            placeholder={`Reply to ${rootComment.author_username}…`}
            onPosted={onReplyPosted}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="underline">
              Log in
            </Link>{' '}
            to reply.
          </p>
        )}
      </div>
    </div>
  );
}
