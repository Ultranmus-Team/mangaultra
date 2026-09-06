import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function AdminUserRow({ user }) {
  return (
    <Link
      href={`/admin/users/${user.id}`}
      className="flex items-center justify-between gap-3 border-b py-3 text-sm transition-colors last:border-b-0 hover:bg-accent"
    >
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium">{user.username}</span>
          <Badge variant="outline" className="capitalize">{user.role}</Badge>
          {user.is_banned && <Badge variant="destructive">Blocked</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{user.series_count} series</p>
      </div>
    </Link>
  );
}
