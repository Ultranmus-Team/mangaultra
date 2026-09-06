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
