'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { updateSettingsAction } from '@/app/admin/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save settings'}
    </Button>
  );
}

export default function PlatformSettingsForm({ settings }) {
  const [state, formAction] = useFormState(updateSettingsAction, { error: null });

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="uploadsPaused" defaultChecked={settings.uploadsPaused} className="h-4 w-4 rounded border-input" />
        Pause new submissions
      </label>
      <div className="space-y-1">
        <Label htmlFor="minChaptersForApproval" className="text-xs">Min. chapters for approval</Label>
        <Input
          id="minChaptersForApproval"
          name="minChaptersForApproval"
          type="number"
          min="1"
          defaultValue={settings.minChaptersForApproval}
          className="w-32"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
