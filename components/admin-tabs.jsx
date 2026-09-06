'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

const TABS = [
  { href: '/admin', label: 'Settings', exact: true },
  { href: '/admin/manga', label: 'Manga' },
  { href: '/admin/chapters', label: 'Chapters' },
  { href: '/admin/users', label: 'Users' },
];

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b">
      {TABS.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
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
