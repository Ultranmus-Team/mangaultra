'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { signOutAction } from '@/app/(auth)/actions';
import CoverPlaceholder from '@/components/cover-placeholder';

export default function UserMenu({ username, avatarUrl }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const closeTimer = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      clearTimeout(closeTimer.current);
    };
  }, []);

  function openNow() {
    clearTimeout(closeTimer.current);
    setOpen(true);
  }

  // A short delay (instead of closing the instant the cursor leaves)
  // survives the gap between the trigger button and the dropdown panel
  // below it, so moving the mouse down into the menu doesn't close it
  // before a click on a menu item lands.
  function closeSoon() {
    closeTimer.current = setTimeout(() => setOpen(false), 250);
  }

  return (
    <div ref={ref} className="relative" onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border transition-colors hover:border-foreground/30"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={username} className="h-full w-full object-cover" />
        ) : (
          <CoverPlaceholder title={username} className="h-full w-full" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 w-52 pt-1">
          <div className="rounded-md border bg-background py-1 shadow-md">
            <div className="border-b px-3 py-2 text-sm font-medium">{username}</div>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              View my manga
            </Link>
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              Profile
            </Link>
            <Link
              href="/dashboard/threads"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm transition-colors hover:bg-accent"
            >
              Threads
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="block w-full px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-accent"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
