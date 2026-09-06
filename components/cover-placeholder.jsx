import { cn } from '@/lib/cn';

// Deterministic per-title color so the same series always gets the same
// placeholder instead of a random one on every render/navigation.
function hueFromTitle(title) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export default function CoverPlaceholder({ title, className }) {
  const safeTitle = title?.trim() || '?';
  const initial = safeTitle[0].toUpperCase();
  const hue = hueFromTitle(safeTitle);

  return (
    <div
      className={cn('flex h-full w-full items-center justify-center [container-type:inline-size]', className)}
      style={{ backgroundColor: `hsl(${hue}, 45%, 32%)` }}
      aria-hidden="true"
    >
      {/* Font size is relative to the container's own width (cqw), not a
          fixed px value, so this same component looks right whether it's a
          36px navbar icon or a 300px cover poster — a fixed text-4xl was
          either invisible-tiny or edge-to-edge depending on where it landed. */}
      <span className="font-semibold leading-none text-white/90 text-[40cqw]">{initial}</span>
    </div>
  );
}
