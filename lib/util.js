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

// Admin accounts never show their individual identity to other users —
// there can be more than one admin, and which specific one acted shouldn't
// matter to the person on the other end. Anywhere a sender/author username
// + avatar pair is displayed to someone other than the account itself
// (review threads, public comments, notifications), this replaces both with
// the platform's own real account — @MangaUltra, a genuine profiles row
// (see scripts-create-mangaultra-account-tmp.js), not a synthetic name —
// so it always resolves to a real, linkable /u/MangaUltra profile instead of
// a placeholder that 404s if anything ever tries to link to it.
export const ADMIN_DISPLAY_NAME = 'MangaUltra';

const MU_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="32" fill="#111827"/>' +
  '<text x="32" y="41" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="22" ' +
  'font-weight="700" fill="#ffffff" text-anchor="middle">MU</text></svg>';

export const ADMIN_AVATAR_URL = `data:image/svg+xml,${encodeURIComponent(MU_ICON_SVG)}`;

// Applies the mask to one row shaped like { ...fields, [usernameKey]: str,
// [avatarKey]: str|null, role: str }. Returns a new object with `role`
// stripped off and an `isAdminIdentity` flag added (named to avoid clashing
// with the unrelated "is the current viewer an admin" prop these rows'
// consumers already thread around). Since @MangaUltra is a real profile,
// every consumer can safely link it like any other user's name — the flag
// is kept around for any future caller that still wants to tell the two
// apart, not because linking it is unsafe.
export function maskAdminIdentity(row, { usernameKey, avatarKey }) {
  const { role, ...rest } = row;
  if (role === 'admin') {
    return { ...rest, [usernameKey]: ADMIN_DISPLAY_NAME, [avatarKey]: ADMIN_AVATAR_URL, isAdminIdentity: true };
  }
  return { ...rest, isAdminIdentity: false };
}
