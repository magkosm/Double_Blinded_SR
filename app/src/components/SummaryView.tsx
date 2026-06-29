import type { DecisionRecord, ScreeningRecord } from '../types';
import { DECISION_LABELS } from '../types';

type Props = {
  papers: ScreeningRecord[];
  decisions: Map<string, DecisionRecord>;
  onClose: () => void;
};

export function SummaryView({ papers, decisions, onClose }: Props) {
  const byDecision = new Map<string, ScreeningRecord[]>();
  for (const p of papers) {
    const d = decisions.get(p.id);
    if (!d) continue;
    const key = d.decision;
    if (!byDecision.has(key)) byDecision.set(key, []);
    byDecision.get(key)!.push(p);
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <h2 className="font-display text-lg font-semibold">Your screening summary</h2>
        <button onClick={onClose} className="text-sm text-brand-600">
          Back to screening
        </button>
      </header>
      <main className="flex-1 overflow-y-auto p-4">
        {(['include', 'exclude', 'maybe', 'skip'] as const).map((dec) => {
          const list = byDecision.get(dec) || [];
          if (list.length === 0) return null;
          return (
            <section key={dec} className="mb-6">
              <h3 className="mb-2 text-sm font-semibold uppercase text-slate-500">
                {DECISION_LABELS[dec]} ({list.length})
              </h3>
              <ul className="space-y-2">
                {list.map((p) => {
                  const rec = decisions.get(p.id)!;
                  return (
                    <li key={p.id} className="rounded-xl bg-white p-4 shadow-sm">
                      <p className="font-medium text-slate-900">{p.title}</p>
                      <p className="text-xs text-slate-500">
                        {p.journal}
                        {p.year ? ` · ${p.year}` : ''}
                      </p>
                      {rec.buckets && rec.buckets.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {rec.buckets.map((b) => (
                            <span key={b} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>
    </div>
  );
}
