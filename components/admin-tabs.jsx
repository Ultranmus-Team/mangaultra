'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/admin', label: 'Settings', exact: true },
  { href: '/admin/manga', label: 'Manga' },
  { href: '/admin/chapters', label: 'Chapters' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/threads', label: 'Threads' },
];

export default function AdminTabs() {
  const pathname = usePathname();
  const activeRef = useRef(null);

  // On narrow screens the tab bar scrolls horizontally instead of
  // wrapping — keep whichever tab is active scrolled into view instead of
  // leaving it hidden off-screen (e.g. after a direct link to /admin/threads).
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  return (
    <div className="flex gap-1 overflow-x-auto border-b [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            ref={active ? activeRef : undefined}
            href={tab.href}
            className={cn(
              'shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
