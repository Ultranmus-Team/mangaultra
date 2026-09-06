// Shared kind → { label, Badge variant } maps for the chapter and series
// review threads — used by both the full ReviewThread and the compact
// inline preview so the two never drift apart.
export const CHAPTER_THREAD_KINDS = {
  resubmit: { label: 'Resubmitted for review', variant: 'secondary' },
  reject: { label: 'Rejected', variant: 'destructive' },
  approve: { label: 'Approved', variant: 'default' },
};

export const SERIES_THREAD_KINDS = {
  resubmit: { label: 'Resubmitted for review', variant: 'secondary' },
  reject: { label: 'Rejected', variant: 'destructive' },
  approve: { label: 'Approved', variant: 'default' },
  delist: { label: 'Delisted', variant: 'destructive' },
};
