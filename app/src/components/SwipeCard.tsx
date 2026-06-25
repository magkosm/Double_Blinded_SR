import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { useState } from 'react';
import type { Decision, ScreeningRecord } from '../types';

const SWIPE_THRESHOLD = 80;

interface SwipeCardProps {
  paper: ScreeningRecord;
  onDecision: (decision: Decision) => void;
  index: number;
  total: number;
}

const OVERLAY_CONFIG = {
  right: { label: 'Include', color: 'text-emerald-600', bg: 'bg-emerald-500/20' },
  left: { label: 'Exclude', color: 'text-rose-600', bg: 'bg-rose-500/20' },
  down: { label: 'Maybe', color: 'text-amber-600', bg: 'bg-amber-500/20' },
  up: { label: 'Skip', color: 'text-slate-600', bg: 'bg-slate-400/20' },
} as const;

type OverlayDir = keyof typeof OVERLAY_CONFIG | null;

export function SwipeCard({ paper, onDecision, index, total }: SwipeCardProps) {
  const [overlayDir, setOverlayDir] = useState<OverlayDir>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0);

  const [{ x, y, rotate, scale }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
  }));

  const bind = useDrag(
    ({ active, movement: [mx, my], direction: [dx, dy], velocity: [vx, vy] }) => {
      const trigger = Math.abs(mx) > SWIPE_THRESHOLD || Math.abs(my) > SWIPE_THRESHOLD;
      const flick = Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5;

      if (!active && (trigger || flick)) {
        let decision: Decision | null = null;
        if (Math.abs(mx) > Math.abs(my)) {
          decision = mx > 0 ? 'include' : 'exclude';
        } else {
          decision = my > 0 ? 'maybe' : 'skip';
        }
        if (decision) {
          api.start({
            x: (dx || Math.sign(mx)) * 500,
            y: (dy || Math.sign(my)) * 500,
            rotate: mx * 0.05,
            scale: 0.9,
          });
          setTimeout(() => onDecision(decision!), 200);
          return;
        }
      }

      if (!active) {
        api.start({ x: 0, y: 0, rotate: 0, scale: 1 });
        setOverlayDir(null);
        setOverlayOpacity(0);
        return;
      }

      api.start({ x: mx, y: my, rotate: mx * 0.05, scale: 1.02, immediate: true });

      if (Math.abs(mx) > Math.abs(my)) {
        setOverlayOpacity(Math.min(Math.abs(mx) / SWIPE_THRESHOLD, 1));
        setOverlayDir(mx > 0 ? 'right' : 'left');
      } else if (Math.abs(my) > 20) {
        setOverlayOpacity(Math.min(Math.abs(my) / SWIPE_THRESHOLD, 1));
        setOverlayDir(my > 0 ? 'down' : 'up');
      } else {
        setOverlayDir(null);
        setOverlayOpacity(0);
      }
    },
    { filterTaps: true },
  );

  const overlayStyle = overlayDir ? OVERLAY_CONFIG[overlayDir] : null;

  return (
    <div className="relative mx-auto h-full w-full max-w-lg">
      <animated.div
        {...bind()}
        style={{ x, y, rotate, scale, touchAction: 'none' }}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-card">
          {overlayStyle && overlayOpacity > 0 && (
            <div
              style={{ opacity: overlayOpacity }}
              className={`absolute inset-0 z-10 flex items-center justify-center ${overlayStyle.bg}`}
            >
              <span className={`text-3xl font-bold ${overlayStyle.color}`}>
                {overlayStyle.label}
              </span>
            </div>
          )}

          <div className="border-b border-slate-100 px-6 py-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="inline-flex max-w-[70%] truncate rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
                {paper.journal}
              </span>
              <span className="shrink-0 text-xs text-slate-400">
                {index + 1} / {total}
              </span>
            </div>
            <h2 className="font-display text-xl font-semibold leading-snug text-slate-900">
              {paper.title}
            </h2>
            {paper.year && <p className="mt-1 text-sm text-slate-400">{paper.year}</p>}
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <p className="text-sm leading-relaxed text-slate-600">{paper.abstract}</p>
          </div>

          <div className="grid grid-cols-4 gap-1 border-t border-slate-100 px-2 py-3 text-center text-[10px] text-slate-400 sm:text-xs">
            <button type="button" onClick={() => onDecision('skip')} className="rounded-lg py-2 hover:bg-slate-50">
              ↑ Skip
            </button>
            <button type="button" onClick={() => onDecision('exclude')} className="rounded-lg py-2 hover:bg-rose-50">
              ← No
            </button>
            <button type="button" onClick={() => onDecision('include')} className="rounded-lg py-2 hover:bg-emerald-50">
              Yes →
            </button>
            <button type="button" onClick={() => onDecision('maybe')} className="rounded-lg py-2 hover:bg-amber-50">
              ↓ Maybe
            </button>
          </div>
        </div>
      </animated.div>
    </div>
  );
}
