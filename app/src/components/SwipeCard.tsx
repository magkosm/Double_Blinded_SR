import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { useRef, useState } from 'react';
import type { Decision, ScreeningRecord } from '../types';
import { useZoneAnchor } from '../hooks/useZoneAnchor';
import {
  BucketDropZones,
  bucketDropScale,
  bucketIndexFromAnchorY,
  SWIPE_THRESHOLD,
  DEEP_LEFT_THRESHOLD,
} from './BucketRail';

interface SwipeCardProps {
  paper: ScreeningRecord;
  onDecision: (decision: Decision, buckets?: string[]) => void;
  index: number;
  total: number;
  titleOnly?: boolean;
  bucketLabels?: string[];
}

const OVERLAY_CONFIG = {
  right: { label: 'Include', color: 'text-emerald-600', bg: 'bg-emerald-500/20' },
  left: { label: 'Exclude', color: 'text-rose-600', bg: 'bg-rose-500/20' },
  down: { label: 'Maybe', color: 'text-amber-600', bg: 'bg-amber-500/20' },
  up: { label: 'Skip', color: 'text-slate-600', bg: 'bg-slate-400/20' },
} as const;

type OverlayDir = keyof typeof OVERLAY_CONFIG | null;

const TOUCH_DEVICE =
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

function pointerY(event: Event | undefined): number {
  if (event && 'clientY' in event && typeof event.clientY === 'number') {
    return event.clientY;
  }
  return window.innerHeight / 2;
}

function isAbstractScrollTarget(event: Event | undefined): boolean {
  if (!event?.target) return false;
  return !!(event.target as HTMLElement).closest('[data-scroll="abstract"]');
}

export function SwipeCard({
  paper,
  onDecision,
  index,
  total,
  titleOnly = false,
  bucketLabels = [],
}: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const lastBucketRef = useRef<number>(-1);

  const [overlayDir, setOverlayDir] = useState<OverlayDir>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [showBucketZones, setShowBucketZones] = useState(false);
  const [highlightedBucket, setHighlightedBucket] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  const zoneAnchor = useZoneAnchor(cardRef, showBucketZones);

  const [{ x, y, rotate, scale }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    config: { tension: 420, friction: 32 },
  }));

  const rotFactor = TOUCH_DEVICE ? 0.012 : 0.04;

  const bind = useDrag(
    ({ active, movement: [mx, my], direction: [dx, dy], velocity: [vx, vy], event, first, cancel }) => {
      if (first && isAbstractScrollTarget(event)) {
        cancel();
        return;
      }

      const absX = Math.abs(mx);
      const absY = Math.abs(my);
      const horizontal = absX > absY;
      const deepLeft =
        horizontal && mx < -DEEP_LEFT_THRESHOLD && bucketLabels.length > 0;
      const trigger = absX > SWIPE_THRESHOLD || absY > SWIPE_THRESHOLD;
      const flick = Math.abs(vx) > 0.55 || Math.abs(vy) > 0.55;
      const clientY = pointerY(event);

      setDragging(active);

      if (!active && (trigger || flick)) {
        if (horizontal && mx < 0) {
          const buckets =
            deepLeft && highlightedBucket !== null && highlightedBucket >= 0
              ? [bucketLabels[highlightedBucket]!]
              : undefined;
          api.start({
            x: (dx || -1) * 500,
            y: my,
            rotate: mx * rotFactor,
            scale: deepLeft ? bucketDropScale(mx, true, true) : 0.92,
          });
          setTimeout(() => onDecision('exclude', buckets), 180);
          setShowBucketZones(false);
          setHighlightedBucket(null);
          lastBucketRef.current = -1;
          return;
        }

        let decision: Decision | null = null;
        if (horizontal) {
          decision = mx > 0 ? 'include' : 'exclude';
        } else {
          decision = my > 0 ? 'maybe' : 'skip';
        }
        if (decision) {
          api.start({
            x: (dx || Math.sign(mx)) * 500,
            y: (dy || Math.sign(my)) * 500,
            rotate: mx * rotFactor,
            scale: 0.92,
          });
          setTimeout(() => onDecision(decision!), 180);
          setShowBucketZones(false);
          return;
        }
      }

      if (!active) {
        api.start({ x: 0, y: 0, rotate: 0, scale: 1 });
        setOverlayDir(null);
        setOverlayOpacity(0);
        setShowBucketZones(false);
        setHighlightedBucket(null);
        lastBucketRef.current = -1;
        return;
      }

      const cardScale = bucketDropScale(mx, deepLeft, true);
      api.start({ x: mx, y: my, rotate: mx * rotFactor, scale: cardScale, immediate: true });

      if (deepLeft) {
        setShowBucketZones(true);
        setOverlayDir('left');
        setOverlayOpacity(Math.min((absX - SWIPE_THRESHOLD) / (DEEP_LEFT_THRESHOLD - SWIPE_THRESHOLD + 36), 1));

        const anchor = cardRef.current?.getBoundingClientRect();
        if (anchor) {
          const idx = bucketIndexFromAnchorY(clientY, { top: anchor.top, height: anchor.height }, bucketLabels.length);
          if (idx !== lastBucketRef.current) {
            lastBucketRef.current = idx;
            setHighlightedBucket(idx >= 0 ? idx : null);
          }
        }
      } else if (horizontal) {
        setShowBucketZones(false);
        setHighlightedBucket(null);
        lastBucketRef.current = -1;
        setOverlayOpacity(Math.min(absX / SWIPE_THRESHOLD, 1));
        setOverlayDir(mx > 0 ? 'right' : 'left');
      } else if (absY > 24) {
        setShowBucketZones(false);
        setHighlightedBucket(null);
        lastBucketRef.current = -1;
        setOverlayOpacity(Math.min(absY / SWIPE_THRESHOLD, 1));
        setOverlayDir(my > 0 ? 'down' : 'up');
      } else {
        setOverlayDir(null);
        setOverlayOpacity(0);
        setShowBucketZones(false);
        setHighlightedBucket(null);
        lastBucketRef.current = -1;
      }
    },
    {
      filterTaps: true,
      touchAction: 'none',
      preventScroll: true,
      threshold: TOUCH_DEVICE ? 14 : 8,
      rubberband: false,
    },
  );

  const overlayStyle = overlayDir ? OVERLAY_CONFIG[overlayDir] : null;
  const zoneOpacity = showBucketZones ? Math.max(overlayOpacity, 0.6) : 0;

  return (
    <>
      <BucketDropZones
        buckets={bucketLabels}
        activeIndex={highlightedBucket}
        visible={showBucketZones}
        opacity={zoneOpacity}
        anchor={zoneAnchor}
      />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-lg flex-1">
        <animated.div
          {...bind()}
          ref={cardRef}
          style={{
            x,
            y,
            rotate,
            scale,
            willChange: dragging ? 'transform' : 'auto',
            touchAction: 'none',
          }}
          className="relative z-10 flex h-full max-h-[70dvh] w-full min-h-0 cursor-grab flex-col overflow-hidden rounded-3xl bg-white shadow-card active:cursor-grabbing"
        >
          {overlayStyle && overlayOpacity > 0 && !showBucketZones && (
            <div
              style={{ opacity: overlayOpacity }}
              className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center ${overlayStyle.bg}`}
            >
              <span className={`text-3xl font-bold ${overlayStyle.color}`}>{overlayStyle.label}</span>
            </div>
          )}

          {showBucketZones && highlightedBucket !== null && highlightedBucket >= 0 && (
            <div
              style={{ opacity: Math.min(overlayOpacity + 0.25, 1) }}
              className="pointer-events-none absolute left-4 top-8 z-10 -rotate-12 rounded-lg border-[3px] border-rose-500/50 px-3 py-1"
            >
              <span className="text-lg font-bold uppercase tracking-wide text-rose-600/80">
                {bucketLabels[highlightedBucket]}
              </span>
            </div>
          )}

          <div className="shrink-0 select-none border-b border-slate-100 px-5 py-4 sm:px-6">
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="text-xs font-medium leading-snug text-brand-700">{paper.journal}</p>
              <span className="shrink-0 text-xs text-slate-400">
                {index + 1} / {total}
              </span>
            </div>
            <h2 className="font-display text-lg font-semibold leading-snug text-slate-900 sm:text-xl">
              {paper.title}
            </h2>
            {paper.year && <p className="mt-1 text-sm text-slate-400">{paper.year}</p>}
            {TOUCH_DEVICE && (
              <p className="mt-2 text-[10px] text-slate-400">Drag card to decide · scroll abstract below</p>
            )}
          </div>

          {!titleOnly && (
            <div
              data-scroll="abstract"
              className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-5 py-4 sm:px-6"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <p className="text-sm leading-relaxed text-slate-600">{paper.abstract}</p>
            </div>
          )}

          {titleOnly && <div className="min-h-0 flex-1" />}

          <div className="grid shrink-0 grid-cols-4 gap-1 border-t border-slate-100 px-2 py-3 text-center text-[10px] text-slate-500 sm:text-xs">
            <button type="button" onClick={() => onDecision('skip')} className="rounded-lg py-2 hover:bg-slate-50">
              ↑ Skip
            </button>
            <button
              type="button"
              onClick={() => onDecision('exclude')}
              className="rounded-lg py-2 hover:bg-rose-50"
              title="Exclude — drag far left to drop into a reason zone"
            >
              ← No
            </button>
            <button type="button" onClick={() => onDecision('include')} className="rounded-lg py-2 hover:bg-emerald-50">
              Yes →
            </button>
            <button type="button" onClick={() => onDecision('maybe')} className="rounded-lg py-2 hover:bg-amber-50">
              ↓ Maybe
            </button>
          </div>
        </animated.div>
      </div>
    </>
  );
}
