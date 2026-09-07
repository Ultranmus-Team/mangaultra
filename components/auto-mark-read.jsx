'use client';

import { useEffect, useRef } from 'react';

// Invisible — fires a Server Action once on mount and renders nothing. Used
// wherever visiting a page should silently sync some notification's read
// state (a chapter page, a comment thread page) without a visible button,
// mirroring MarkThreadReadButton's autoFire mode but generic over any action.
export default function AutoMarkRead({ action, args = [] }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    action(...args);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
