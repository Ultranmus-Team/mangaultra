'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { signUpAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import GoogleSignInButton from '@/components/google-signin-button';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Creating account…' : 'Create account'}
    </Button>
  );
}

export default function SignupPage() {
  const [state, formAction] = useFormState(signUpAction, { error: null });

  if (state?.success) {
    return (
      <div className="mx-auto flex max-w-sm flex-col justify-center py-10">
        <Card>
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/login" className="text-sm font-medium underline underline-offset-4">
              Back to log in
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col justify-center py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Start publishing your manga or novel.</CardDescription>
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
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <SubmitButton />
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
                Log in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
