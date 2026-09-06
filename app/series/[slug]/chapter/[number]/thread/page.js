import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { query } from '@/lib/db';
import { getCurrentProfile } from '@/lib/session';
import {
  getChapterReviewMessages,
  getChapterReviewMessageCount,
  getThreadLastReadAt,
  getChapterFirstUnreadIndex,
} from '@/lib/creator';
import ChapterReviewThread from '@/components/chapter-review-thread';

export const dynamic = 'force-dynamic';

// Chat-style opening window: land on the last INITIAL_WINDOW messages if
// everything's read, or on the first unread message (with a little older
// context above it) if not — older history beyond that loads on scroll.
const INITIAL_WINDOW = 20;
const UNREAD_CONTEXT = 10;

async function getChapterContext(slug, chapterNumber) {
  const { rows } = await query(
    `SELECT c.id, c.chapter_number, c.title,
            s.id AS series_id, s.canonical_slug, s.title AS series_title, s.creator_id
     FROM chapters c
     JOIN series s ON s.id = c.series_id
     WHERE s.canonical_slug = $1 AND c.chapter_number = $2`,
    [slug, chapterNumber]
  );
  return rows[0] || null;
}

export default async function ChapterThreadPage({ params }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const chapter = await getChapterContext(params.slug, params.number);
  if (!chapter) notFound();

  const isOwner = profile.id === chapter.creator_id;
  const isAdmin = profile.role === 'admin';
  if (!isOwner && !isAdmin) {
    redirect(`/series/${chapter.canonical_slug}/chapter/${chapter.chapter_number}`);
  }

  const total = await getChapterReviewMessageCount(chapter.id);
  const lastReadAt = await getThreadLastReadAt(profile.id, 'chapter', chapter.id);
  // Position of the first unread message across the whole thread — used
  // both to land there by default and to know whether there's any unread
  // message at all, independent of how much history has been loaded.
  const firstUnreadIndex = await getChapterFirstUnreadIndex(chapter.id, lastReadAt);
  const isUnread = firstUnreadIndex < total;

  const initialOffset = isUnread
    ? Math.max(0, firstUnreadIndex - UNREAD_CONTEXT)
    : Math.max(0, total - INITIAL_WINDOW);

  const messages =
    total > 0 ? await getChapterReviewMessages(chapter.id, { limit: total - initialOffset, offset: initialOffset }) : [];

  const contentPath = `/series/${chapter.canonical_slug}/chapter/${chapter.chapter_number}`;
  const basePath = `${contentPath}/thread`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href={contentPath} className="text-sm text-muted-foreground hover:underline">
          ← Chapter {chapter.chapter_number}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {chapter.series_title} — Chapter {chapter.chapter_number}
          {chapter.title ? ` — ${chapter.title}` : ''}
        </h1>
      </div>

      <ChapterReviewThread
        seriesId={chapter.series_id}
        chapterId={chapter.id}
        messages={messages}
        initialOffset={initialOffset}
        unread={{
          isUnread,
          lastReadAt,
          threadType: 'chapter',
          threadId: chapter.id,
          extraPaths: [contentPath, basePath],
        }}
      />
    </div>
  );
}
