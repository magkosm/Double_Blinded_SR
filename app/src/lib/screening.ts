import type { DecisionRecord, ScreeningRecord, ProgressStats } from '../types';

export function buildQueue(
  papers: ScreeningRecord[],
  decisions: Map<string, DecisionRecord>,
): ScreeningRecord[] {
  const undecided = papers.filter((p) => !decisions.has(p.id));
  const skipped = papers.filter((p) => decisions.get(p.id)?.decision === 'skip');

  if (undecided.length > 0) return undecided;
  return skipped;
}

export function computeStats(
  papers: ScreeningRecord[],
  decisions: Map<string, DecisionRecord>,
): {
  include: number;
  exclude: number;
  maybe: number;
  skip: number;
  pending: number;
  total: number;
} {
  const total = papers.length > 0 ? papers.length : decisions.size;
  let include = 0;
  let exclude = 0;
  let maybe = 0;
  let skip = 0;

  for (const d of decisions.values()) {
    switch (d.decision) {
      case 'include':
        include++;
        break;
      case 'exclude':
        exclude++;
        break;
      case 'maybe':
        maybe++;
        break;
      case 'skip':
        skip++;
        break;
    }
  }

  const decided = include + exclude + maybe + skip;
  return {
    include,
    exclude,
    maybe,
    skip,
    pending: Math.max(0, total - decided),
    total,
  };
}

/** Merge decision maps from all reviewers for admin overview stats. */
export function aggregateDecisionStats(
  papers: ScreeningRecord[],
  decisionMaps: Map<string, DecisionRecord>[],
): ProgressStats {
  if (decisionMaps.length === 0) {
    return computeStats(papers, new Map());
  }
  if (decisionMaps.length === 1) {
    return computeStats(papers, decisionMaps[0]!);
  }

  const merged = new Map<string, DecisionRecord>();
  for (const map of decisionMaps) {
    for (const [paperId, record] of map) {
      if (!merged.has(paperId)) merged.set(paperId, record);
    }
  }
  return computeStats(papers, merged);
}

export function decisionsToMap(records: DecisionRecord[]): Map<string, DecisionRecord> {
  return new Map(records.map((r) => [r.paperId, r]));
}

export function exportCsv(
  papers: ScreeningRecord[],
  reviewerDecisions: Map<string, Map<string, DecisionRecord>>,
  reviewerNames: Map<string, string>,
): string {
  const reviewerIds = [...reviewerDecisions.keys()];
  const headers = ['id', 'title', 'journal', 'year', 'doi', ...reviewerIds.map((id) => reviewerNames.get(id) || id)];
  const rows = papers.map((p) => {
    const base = [p.id, escapeCsv(p.title), escapeCsv(p.journal), p.year?.toString() || '', p.doi || ''];
    const decs = reviewerIds.map((id) => reviewerDecisions.get(id)?.get(p.id)?.decision || '');
    return [...base, ...decs].join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildStage2Queue(
  papers: ScreeningRecord[],
  decisions: Map<string, DecisionRecord>,
): ScreeningRecord[] {
  return papers.filter((p) => {
    const d = decisions.get(p.id);
    return d && (d.decision === 'include' || d.decision === 'maybe');
  });
}

export function getCurrentPaper(
  papers: ScreeningRecord[],
  decisions: Map<string, DecisionRecord>,
  index: number,
): ScreeningRecord | null {
  const queue = buildQueue(papers, decisions);
  if (queue.length === 0) return null;
  return queue[Math.min(index, queue.length - 1)] ?? null;
}
