'use client';

import { useState, useTransition } from 'react';
import { submitForApprovalAction } from '@/app/dashboard/actions';
import { Button } from '@/components/ui/button';

export default function SubmitForReviewButton({ seriesId, disabled }) {
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <Button
        disabled={disabled || isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await submitForApprovalAction(seriesId);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {isPending ? 'Submitting…' : 'Submit for review'}
      </Button>
    </div>
  );
}
