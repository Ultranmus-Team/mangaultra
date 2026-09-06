'use client';

import ReviewThread from '@/components/review-thread';
import { sendUserBlockMessageAction } from '@/app/admin/actions';
import { sendMyBlockMessageAction } from '@/app/dashboard/actions';

const KIND_LABEL = {
  block: 'Blocked',
  unblock: 'Unblocked',
};

// isAdminView picks which action posts a message: an admin messaging a
// user they're managing, or the blocked user themself appealing.
export default function UserBlockThread({ userId, messages, isAdminView }) {
  return (
    <ReviewThread
      messages={messages}
      kindLabels={KIND_LABEL}
      onSend={(formData) =>
        isAdminView ? sendUserBlockMessageAction(userId, null, formData) : sendMyBlockMessageAction(null, formData)
      }
    />
  );
}
