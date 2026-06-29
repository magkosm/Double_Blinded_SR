import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type ZoneAnchor = {
  top: number;
  height: number;
};

export function useZoneAnchor(
  targetRef: RefObject<HTMLElement | null>,
  active: boolean,
): ZoneAnchor | null {
  const anchorRef = useRef<ZoneAnchor | null>(null);
  const [, bump] = useState(0);

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const next = { top: r.top, height: r.height };
    const prev = anchorRef.current;
    if (!prev || prev.top !== next.top || prev.height !== next.height) {
      anchorRef.current = next;
      bump((n) => n + 1);
    }
  }, [targetRef]);

  useEffect(() => {
    if (!active) {
      anchorRef.current = null;
      bump((n) => n + 1);
      return;
    }
    measure();
    const el = targetRef.current;
    if (!el) return;

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure, { passive: true });
    window.addEventListener('scroll', measure, { passive: true, capture: true });

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [active, measure, targetRef]);

  return active ? anchorRef.current : null;
}
