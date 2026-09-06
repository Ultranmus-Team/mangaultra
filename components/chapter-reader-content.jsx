import sanitizeHtml from 'sanitize-html';
import { query } from '@/lib/db';

const RENDER_SANITIZE_OPTIONS = {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'blockquote', 'ul', 'ol', 'li', 'a', 'code', 'pre'],
  allowedAttributes: { a: ['href', 'rel', 'target'] },
};

// Chapter bodies written through the rich-text editor are HTML; older
// chapters (seeded demo data, anything written before the editor existed)
// are plain text with blank-line paragraph breaks. Detect which one this is
// rather than requiring a data migration.
function looksLikeHtml(body) {
  return /<[a-z][\s\S]*>/i.test(body);
}

async function getPages(chapterId) {
  const { rows } = await query(
    'SELECT page_number, cdn_image_url FROM chapter_pages WHERE chapter_id = $1 ORDER BY page_number ASC',
    [chapterId]
  );
  return rows;
}

export default async function ChapterReaderContent({ contentType, chapter }) {
  if (contentType === 'manga') {
    const pages = await getPages(chapter.id);
    if (pages.length === 0) {
      return <p className="text-sm text-muted-foreground">No pages uploaded for this chapter.</p>;
    }
    return (
      <div className="flex flex-col gap-2">
        {pages.map((p) => (
          <div key={p.page_number} className="relative w-full overflow-hidden rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.cdn_image_url} alt={`Page ${p.page_number}`} className="w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (looksLikeHtml(chapter.body)) {
    const safeHtml = sanitizeHtml(chapter.body, RENDER_SANITIZE_OPTIONS);
    return (
      <article
        className="prose prose-neutral max-w-none text-base leading-relaxed prose-headings:font-semibold"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    );
  }

  return (
    <article className="prose prose-neutral max-w-none whitespace-pre-wrap text-base leading-relaxed">
      {chapter.body}
    </article>
  );
}
