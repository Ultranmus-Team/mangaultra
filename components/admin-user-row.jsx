import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import CoverPlaceholder from '@/components/cover-placeholder';

export default function AdminUserRow({ user }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-4 last:border-b-0">
      <Link href={`/admin/users/${user.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80">
        {user.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt={user.username} className="h-11 w-11 shrink-0 rounded-full border object-cover" />
        ) : (
          <CoverPlaceholder title={user.username} className="h-11 w-11 shrink-0 rounded-full border" />
        )}
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{user.username}</span>
            <Badge variant="outline" className="capitalize">{user.role}</Badge>
            {user.is_banned && <Badge variant="destructive">Blocked</Badge>}
          </div>
          {user.email && <p className="truncate text-xs text-muted-foreground">{user.email}</p>}
          <p className="text-xs text-muted-foreground">
            {user.manga_count} manga · {user.novel_count} novels
          </p>
        </div>
      </Link>
      <Link
        href={`/u/${user.username}`}
        className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
      >
        Profile
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
