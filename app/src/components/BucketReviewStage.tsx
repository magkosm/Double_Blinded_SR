import { useRef, useState } from 'react';
import type { DecisionRecord, ScreeningRecord } from '../types';
import { DECISION_LABELS } from '../types';
import { useZoneAnchor } from '../hooks/useZoneAnchor';
import { BucketDropZones } from './BucketRail';

type Props = {
  papers: ScreeningRecord[];
  decisions: Map<string, DecisionRecord>;
  buckets: string[];
  onComplete: (updated: Map<string, DecisionRecord>) => void;
};

export function BucketReviewStage({ papers, decisions, buckets, onComplete }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const zoneAnchor = useZoneAnchor(cardRef, true);

  const needsReview = papers.filter((p) => {
    const d = decisions.get(p.id);
    return d && (d.decision === 'exclude' || d.decision === 'maybe');
  });

  const [index, setIndex] = useState(0);
  const [localDecisions, setLocalDecisions] = useState(() => new Map(decisions));

  if (needsReview.length === 0) {
    return null;
  }

  const paper = needsReview[index]!;
  const record = localDecisions.get(paper.id)!;
  const selected = record.buckets ?? [];

  function toggleBucket(label: string) {
    const current = localDecisions.get(paper.id)!;
    const set = new Set(current.buckets ?? []);
    if (set.has(label)) set.delete(label);
    else set.add(label);
    const updated = new Map(localDecisions);
    updated.set(paper.id, { ...current, buckets: [...set] });
    setLocalDecisions(updated);
  }

  function goNext() {
    if (index < needsReview.length - 1) {
      setIndex((i) => i + 1);
    } else {
      onComplete(localDecisions);
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col overscroll-none bg-slate-100">
      <BucketDropZones
        buckets={buckets}
        activeIndex={null}
        selected={selected}
        mode="select"
        onSelect={toggleBucket}
        visible
        opacity={0.9}
        anchor={zoneAnchor}
      />

      <header className="relative z-10 shrink-0 border-b bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase text-slate-500">Assign reasons</p>
            <p className="text-sm font-semibold text-slate-800">
              {index + 1} / {needsReview.length} — {DECISION_LABELS[record.decision]}
            </p>
          </div>
          <button type="button" onClick={() => onComplete(localDecisions)} className="text-sm text-slate-500">
            Skip all
          </button>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col p-4 pl-[max(11vw,3rem)]">
        <div
          ref={cardRef}
          className="flex flex-1 flex-col rounded-2xl bg-white p-5 shadow-sm"
        >
          <span className="text-xs text-slate-400">
            {paper.journal}
            {paper.year ? ` · ${paper.year}` : ''}
          </span>
          <h2 className="mt-2 font-display text-lg font-semibold leading-snug text-slate-900">{paper.title}</h2>
          <p className="mt-4 text-sm text-slate-500">
            Tap a zone on the left (same height as this card) to tag. Optional — tap Next to continue.
          </p>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={goNext}
            className="flex-1 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white"
          >
            {index < needsReview.length - 1 ? 'Next paper' : 'Finish'}
          </button>
        </div>
      </main>
    </div>
  );
}
