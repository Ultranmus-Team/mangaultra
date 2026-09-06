'use client';

import ReviewThread from '@/components/review-thread';
import { sendChapterMessageAction, loadOlderChapterMessagesAction } from '@/app/dashboard/actions';
import { CHAPTER_THREAD_KINDS } from '@/lib/thread-kinds';

export default function ChapterReviewThread({ seriesId, chapterId, messages, initialOffset, unread }) {
  return (
    <ReviewThread
      messages={messages}
      kindLabels={CHAPTER_THREAD_KINDS}
      initialOffset={initialOffset}
      unread={unread}
      onSend={(formData) => sendChapterMessageAction(seriesId, chapterId, null, formData)}
      onLoadOlder={(offset, limit) => loadOlderChapterMessagesAction(chapterId, offset, limit)}
    />
  );
}
