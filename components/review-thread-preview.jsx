import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import CoverPlaceholder from '@/components/cover-placeholder';
import MarkThreadReadButton from '@/components/mark-thread-read-button';
import { formatRelativeTime } from '@/lib/util';

// The compact version shown inline on the manga/chapter page itself — just
// the latest message and a count, with a "View thread" link to the full,
// paginated conversation at its own page.
export default function ReviewThreadPreview({ messages, href, kindLabels, isUnread, threadType, threadId }) {
  const latest = messages[messages.length - 1];
  const kind = latest && kindLabels[latest.kind];

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
          Review notes{messages.length > 0 ? ` (${messages.length})` : ''}
        </h2>
        <div className="flex items-center gap-2">
          {isUnread && <MarkThreadReadButton threadType={threadType} threadId={threadId} />}
          <Link href={href}>
            <Button type="button" variant="outline" size="sm">
              View thread
            </Button>
          </Link>
        </div>
      </div>

      {latest ? (
        <div className="flex gap-2.5">
          {latest.sender_avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={latest.sender_avatar_url}
              alt={latest.sender_username}
              className="h-8 w-8 shrink-0 rounded-full border object-cover"
            />
          ) : (
            <CoverPlaceholder title={latest.sender_username} className="h-8 w-8 shrink-0 rounded-full border" />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{latest.sender_username}</span>
              {kind && <Badge variant={kind.variant}>{kind.label}</Badge>}
              <span>{formatRelativeTime(latest.created_at)}</span>
            </div>
            {latest.body && (
              <blockquote className="truncate border-l-2 pl-2 text-xs italic text-muted-foreground">
                “{latest.body}”
              </blockquote>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      )}
    </div>
  );
}
