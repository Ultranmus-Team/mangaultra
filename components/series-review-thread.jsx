'use client';

import ReviewThread from '@/components/review-thread';
import { sendSeriesMessageAction, loadOlderSeriesMessagesAction } from '@/app/dashboard/actions';
import { SERIES_THREAD_KINDS } from '@/lib/thread-kinds';

export default function SeriesReviewThread({ seriesId, messages, initialOffset, unread }) {
  return (
    <ReviewThread
      messages={messages}
      kindLabels={SERIES_THREAD_KINDS}
      initialOffset={initialOffset}
      unread={unread}
      onSend={(formData) => sendSeriesMessageAction(seriesId, null, formData)}
      onLoadOlder={(offset, limit) => loadOlderSeriesMessagesAction(seriesId, offset, limit)}
    />
  );
}
