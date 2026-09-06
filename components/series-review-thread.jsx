'use client';

import ReviewThread from '@/components/review-thread';
import { sendSeriesMessageAction } from '@/app/dashboard/actions';

const KIND_LABEL = {
  resubmit: 'Resubmitted for review',
  reject: 'Rejected',
  approve: 'Approved',
  delist: 'Delisted',
};

export default function SeriesReviewThread({ seriesId, messages }) {
  return (
    <ReviewThread
      messages={messages}
      kindLabels={KIND_LABEL}
      onSend={(formData) => sendSeriesMessageAction(seriesId, null, formData)}
    />
  );
}
