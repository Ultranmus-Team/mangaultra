import { Badge } from '@/components/ui/badge';

// Covers both series moderation_status (draft/pending_review/approved/
// rejected/delisted) and chapter status (published/hidden/rejected/
// pending_review) — the two overlap on rejected/pending_review by design.
const VARIANTS = {
  draft: 'secondary',
  pending_review: 'outline',
  approved: 'default',
  published: 'default',
  hidden: 'secondary',
  rejected: 'destructive',
  delisted: 'destructive',
};

const LABELS = {
  draft: 'Draft',
  pending_review: 'Pending review',
  approved: 'Approved',
  published: 'Published',
  hidden: 'Hidden',
  rejected: 'Rejected',
  delisted: 'Delisted',
};

export default function StatusBadge({ status }) {
  return <Badge variant={VARIANTS[status] || 'secondary'}>{LABELS[status] || status}</Badge>;
}
