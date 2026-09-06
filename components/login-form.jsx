'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signInAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import GoogleSignInButton from '@/components/google-signin-button';

const REDIRECT_ERROR_MESSAGES = {
  auth_callback_failed: 'Google sign-in failed. Please try again.',
  auth_confirm_failed: 'That confirmation link is invalid or has expired. Try logging in if you already confirmed, or sign up again.',
  google_oauth_failed: 'Google sign-in failed. Please try again.',
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Logging in…' : 'Log in'}
    </Button>
  );
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const redirectError = REDIRECT_ERROR_MESSAGES[searchParams.get('error')] || null;

  const [state, formAction] = useFormState(signInAction, { error: redirectError });

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center py-10">
      <Card>
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Welcome back. Enter your details to continue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <GoogleSignInButton />
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </CardContent>
        <form action={formAction}>
          <CardContent className="space-y-4">
            {state?.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
                {state.noAccount && (
                  <>
                    {' '}
                    <Link href="/signup" className="font-medium underline underline-offset-4">
                      Create one?
                    </Link>
                  </>
                )}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <SubmitButton />
            <p className="text-center text-sm text-muted-foreground">
              No account?{' '}
              <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
                Sign up
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
