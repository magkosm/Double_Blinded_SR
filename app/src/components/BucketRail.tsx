import { createPortal } from 'react-dom';
import type { ZoneAnchor } from '../hooks/useZoneAnchor';

export const SWIPE_THRESHOLD = 80;
export const DEEP_LEFT_THRESHOLD = 100;
const DROP_SCALE_RANGE = 90;

type BucketDropZonesProps = {
  buckets: string[];
  activeIndex: number | null;
  selected?: string[];
  mode?: 'highlight' | 'select';
  onSelect?: (label: string) => void;
  visible: boolean;
  opacity?: number;
  anchor: ZoneAnchor | null;
};

/** Left 10% of viewport, height aligned to the screening card. */
export function BucketDropZones({
  buckets,
  activeIndex,
  selected = [],
  mode = 'highlight',
  onSelect,
  visible,
  opacity = 1,
  anchor,
}: BucketDropZonesProps) {
  if (!visible || buckets.length === 0 || !anchor || anchor.height < 40) return null;

  const interactive = mode === 'select';

  const zones = (
    <div
      className="pointer-events-none fixed left-0 z-[200] flex w-[10vw] min-w-[2.75rem] max-w-[7.5rem] flex-col overflow-hidden rounded-r-2xl border border-l-0 border-rose-400/45 shadow-[4px_0_20px_rgba(244,63,94,0.15)]"
      style={{
        opacity,
        top: anchor.top,
        height: anchor.height,
      }}
      aria-label="Exclusion reason zones"
      role="list"
    >
      {buckets.map((label, i) => {
        const isActive = mode === 'select' ? selected.includes(label) : activeIndex === i;

        return (
          <div
            key={label}
            role={interactive ? 'button' : 'listitem'}
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? () => onSelect?.(label) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect?.(label);
                    }
                  }
                : undefined
            }
            className={`flex flex-1 items-center justify-center border-b border-rose-300/25 px-0.5 transition-colors duration-75 last:border-b-0 ${
              isActive ? 'bg-rose-500/45' : 'bg-rose-500/18'
            } ${interactive ? 'pointer-events-auto cursor-pointer hover:bg-rose-500/32' : ''}`}
          >
            <span
              className={`max-h-[90%] overflow-hidden text-center text-[9px] font-bold uppercase leading-tight tracking-tight sm:text-[10px] ${
                isActive ? 'text-rose-950' : 'text-rose-950/55'
              }`}
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );

  return createPortal(zones, document.body);
}

/** Which zone the pointer is over within the card-height band. */
export function bucketIndexFromAnchorY(clientY: number, anchor: ZoneAnchor, count: number): number {
  if (count <= 0) return -1;
  const relativeY = clientY - anchor.top;
  if (relativeY < 0 || relativeY > anchor.height) return -1;
  const slotH = anchor.height / count;
  const idx = Math.floor(relativeY / slotH);
  return Math.max(0, Math.min(count - 1, idx));
}

/** Card scale shrinks as the user drags deeper left toward a drop zone. */
export function bucketDropScale(movementX: number, deepLeft: boolean, dragging: boolean): number {
  if (!dragging) return 1;
  if (!deepLeft) return 1.01;
  const depth = Math.max(0, -movementX - DEEP_LEFT_THRESHOLD);
  const t = Math.min(depth / DROP_SCALE_RANGE, 1);
  return 1.01 - t * 0.32;
}

/** @deprecated use BucketDropZones */
export const BucketRail = BucketDropZones;
