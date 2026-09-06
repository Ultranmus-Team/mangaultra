'use client';

import { useFormStatus } from 'react-dom';
import { signInWithGoogleAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {pending ? 'Redirecting…' : 'Continue with Google'}
    </Button>
  );
}

export default function GoogleSignInButton() {
  return (
    <form action={signInWithGoogleAction}>
      <SubmitButton />
    </form>
  );
}
