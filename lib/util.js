export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Neither the email/password flow nor Google sign-in collect a username
// from the user, so one is always derived from their email.
export function generateUsername(email) {
  const base = email ? email.split('@')[0] : 'creator';
  return `${slugify(base)}-${Math.random().toString(36).slice(2, 6)}`;
}

// "just now" / "5m ago" / "3h ago" / "2d ago" for anything recent, falling
// back to a plain date once it's old enough that the exact day matters more
// than how long ago it was — same formatting used for comment/reply
// timestamps. The "ago" suffix is what makes "3h" actually read as a time
// rather than a duration/count at a glance.
export function formatRelativeTime(dateInput) {
  const date = new Date(dateInput);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
