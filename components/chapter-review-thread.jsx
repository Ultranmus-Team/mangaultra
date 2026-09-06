'use client';

import ReviewThread from '@/components/review-thread';
import { sendChapterMessageAction } from '@/app/dashboard/actions';

const KIND_LABEL = {
  resubmit: 'Resubmitted for review',
  reject: 'Rejected',
  approve: 'Approved',
};

export default function ChapterReviewThread({ seriesId, chapterId, messages }) {
  return (
    <ReviewThread
      messages={messages}
      kindLabels={KIND_LABEL}
      onSend={(formData) => sendChapterMessageAction(seriesId, chapterId, null, formData)}
    />
  );
}
