import Image from 'next/image';
import CoverPlaceholder from '@/components/cover-placeholder';
import { cn } from '@/lib/cn';

// Single place that decides "real cover image vs. initials placeholder" so
// every series listing (browse, series page, dashboard, admin) renders the
// same way instead of each page re-implementing the fallback.
export default function SeriesCover({ src, title, className, sizes }) {
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {src ? (
        <Image src={src} alt={title} fill sizes={sizes} className="object-cover" />
      ) : (
        <CoverPlaceholder title={title} />
      )}
    </div>
  );
}
