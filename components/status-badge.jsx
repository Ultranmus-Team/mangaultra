import { Badge } from '@/components/ui/badge';

const VARIANTS = {
  draft: 'secondary',
  pending_review: 'outline',
  approved: 'default',
  rejected: 'destructive',
  delisted: 'destructive',
};

const LABELS = {
  draft: 'Draft',
  pending_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  delisted: 'Delisted',
};

export default function StatusBadge({ status }) {
  return <Badge variant={VARIANTS[status] || 'secondary'}>{LABELS[status] || status}</Badge>;
}
