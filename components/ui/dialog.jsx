'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

// Minimal centered-popup dialog (no external dependency) used anywhere a
// confirmation or a form needs more room than a dropdown menu can offer.
export default function Dialog({ open, onClose, title, children, className }) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn('relative w-full max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-lg', className)}
      >
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body
  );
}
