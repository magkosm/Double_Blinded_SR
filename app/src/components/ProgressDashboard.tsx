import type { ProgressStats, RisBatch } from '../types';
import { formatReviewerProgress } from '../lib/admin-crypto';

type ReviewerRow = {
  id: string;
  username: string;
  stats: ProgressStats;
};

type Props = {
  papers: { sourceBatchId?: string }[];
  reviewers: ReviewerRow[];
  batches: RisBatch[];
  stats: ProgressStats;
  conflicts?: { paperId: string; decisions: Record<string, string> }[];
  stage2Count?: number;
};

export function ProgressDashboard({ papers, reviewers, batches, stats, conflicts = [], stage2Count = 0 }: Props) {
  const byBatch = batches.map((b) => ({
    ...b,
    count: papers.filter((p) => p.sourceBatchId === b.id).length,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending" value={stats.pending} color="bg-slate-100 text-slate-800" />
        <StatCard label="Include" value={stats.include} color="bg-emerald-100 text-emerald-800" />
        <StatCard label="Exclude" value={stats.exclude} color="bg-rose-100 text-rose-800" />
        <StatCard label="Maybe" value={stats.maybe} color="bg-amber-100 text-amber-800" />
      </div>

      {stage2Count > 0 && (
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Stage 2 funnel: <strong>{stage2Count}</strong> papers eligible (include + maybe)
        </div>
      )}

      {batches.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">RIS batches</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2">Label</th>
                  <th className="px-4 py-2">File</th>
                  <th className="px-4 py-2">Records</th>
                  <th className="px-4 py-2">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {byBatch.map((b) => (
                  <tr key={b.id} className="border-t border-slate-50">
                    <td className="px-4 py-2 font-medium">{b.label}</td>
                    <td className="px-4 py-2 text-slate-600">{b.filename}</td>
                    <td className="px-4 py-2">{b.count || b.recordCount}</td>
                    <td className="px-4 py-2 text-slate-500">{new Date(b.uploadedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {conflicts.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Conflicts ({conflicts.length})</h3>
          <ul className="max-h-40 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50 text-sm">
            {conflicts.slice(0, 20).map((c) => (
              <li key={c.paperId} className="border-b border-amber-100 px-4 py-2 font-mono text-xs">
                Paper {c.paperId.slice(0, 8)}… — {Object.entries(c.decisions).map(([k, v]) => `${k}:${v}`).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Per-reviewer progress</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Reviewer</th>
                <th className="px-4 py-2">Done</th>
                <th className="px-4 py-2">Include</th>
                <th className="px-4 py-2">Exclude</th>
                <th className="px-4 py-2">Maybe</th>
              </tr>
            </thead>
            <tbody>
              {reviewers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    No reviewers yet — create one below to start screening
                  </td>
                </tr>
              )}
              {reviewers.map((r) => (
                <tr key={r.id} className="border-t border-slate-50">
                  <td className="px-4 py-2 font-medium">{r.username}</td>
                  <td className="px-4 py-2">{formatReviewerProgress(r.stats)}</td>
                  <td className="px-4 py-2">{r.stats.include}</td>
                  <td className="px-4 py-2">{r.stats.exclude}</td>
                  <td className="px-4 py-2">{r.stats.maybe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${color}`}>
      <p className="text-xs font-medium uppercase opacity-70">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
