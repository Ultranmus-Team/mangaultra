import Link from 'next/link';
import { getCurrentProfile } from '@/lib/session';
import { Button } from '@/components/ui/button';
import UserMenu from '@/components/user-menu';
import NotificationBell from '@/components/notification-bell';

export default async function Navbar() {
  const profile = await getCurrentProfile();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Manga Ultra
        </Link>

        <nav className="flex items-center gap-1">
          <Link href="/" className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
            Browse
          </Link>

          {profile ? (
            <>
              <Link href="/dashboard" className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                Dashboard
              </Link>
              {profile.role === 'admin' && (
                <Link href="/admin" className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Admin
                </Link>
              )}
              <NotificationBell userId={profile.id} />
              <span className="ml-2">
                <UserMenu username={profile.username} avatarUrl={profile.avatar_url} />
              </span>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">Log in</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
