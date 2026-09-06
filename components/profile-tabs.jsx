'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { updateProfileAction, changePasswordAction } from '@/app/profile/actions';
import { signOutAction } from '@/app/(auth)/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import CoverPlaceholder from '@/components/cover-placeholder';
import MySeriesCard from '@/components/my-series-card';
import { cn } from '@/lib/cn';

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'manga', label: 'My manga' },
  { id: 'security', label: 'Security' },
];

function SaveButton({ children }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : children}
    </Button>
  );
}

function ProfileForm({ profile }) {
  const [state, formAction] = useFormState(updateProfileAction, { error: null });
  const [avatarPreview, setAvatarPreview] = useState(null);

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  function onAvatarChange(e) {
    const file = e.target.files?.[0];
    setAvatarPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  return (
    <Card>
      <form action={formAction}>
        <CardContent className="space-y-4 pt-6">
          {state?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}
          {state?.success && (
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm">Profile updated.</p>
          )}

          <div className="flex items-center gap-4">
            {avatarPreview || profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarPreview || profile.avatar_url}
                alt={profile.username}
                className="h-16 w-16 rounded-full border object-cover"
              />
            ) : (
              <CoverPlaceholder title={profile.username} className="h-16 w-16 rounded-full border" />
            )}
            <div className="flex-1 space-y-1">
              <Label htmlFor="avatar">Avatar (optional)</Label>
              <Input id="avatar" name="avatar" type="file" accept="image/*" onChange={onAvatarChange} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Username</Label>
            <p className="text-sm font-medium">@{profile.username}</p>
            <p className="text-xs text-muted-foreground">
              Permanent — it's part of your public profile and series URLs, so it can't be changed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio (optional)</Label>
            <Textarea
              id="bio"
              name="bio"
              rows={4}
              defaultValue={profile.bio || ''}
              placeholder="Tell readers a bit about yourself"
            />
          </div>
        </CardContent>
        <CardFooter>
          <SaveButton>Save changes</SaveButton>
        </CardFooter>
      </form>
    </Card>
  );
}

function MyMangaTab({ series, username }) {
  if (series.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          You haven't created a series yet.{' '}
          <Link href="/dashboard/new" className="font-medium text-foreground underline underline-offset-4">
            Start one
          </Link>
          .
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        This is everything you've created, including drafts only you can see. Readers see your published work at{' '}
        <Link href={`/u/${username}`} className="font-medium text-foreground underline underline-offset-4">
          your public profile
        </Link>
        .
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {series.map((s) => (
          <MySeriesCard key={s.id} series={s} />
        ))}
      </div>
    </div>
  );
}

function SecurityForm({ hasPassword }) {
  const [state, formAction] = useFormState(changePasswordAction, { error: null });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{hasPassword ? 'Change password' : 'Set a password'}</CardTitle>
        <CardDescription>
          {hasPassword
            ? 'Update the password you use to log in.'
            : 'You signed up with Google. Set a password so you can also log in with your email.'}
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="space-y-4">
          {state?.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          )}
          {state?.success && (
            <p className="rounded-md bg-primary/10 px-3 py-2 text-sm">Password updated.</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" required autoComplete="new-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" required autoComplete="new-password" />
          </div>
        </CardContent>
        <CardFooter>
          <SaveButton>{hasPassword ? 'Update password' : 'Set password'}</SaveButton>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ProfileTabs({ profile, series, hasPassword }) {
  const [tab, setTab] = useState('profile');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 border-b pb-3">
        <nav className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                tab === t.id
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <form action={signOutAction}>
          <Button type="submit" variant="destructive" size="sm">
            Sign out
          </Button>
        </form>
      </div>

      {tab === 'profile' && <ProfileForm profile={profile} />}
      {tab === 'manga' && <MyMangaTab series={series} username={profile.username} />}
      {tab === 'security' && <SecurityForm hasPassword={hasPassword} />}
    </div>
  );
}
