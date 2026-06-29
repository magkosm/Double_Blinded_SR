import type { Decision, DecisionRecord, ScreeningRecord } from '../types';

const PASS_DECISIONS = new Set<Decision>(['include', 'maybe']);

/** Reconstruct a RIS record from a screening record. */
export function recordToRis(record: ScreeningRecord): string {
  const lines: string[] = ['TY  - JOUR', `TI  - ${record.title}`];

  if (record.journal && record.journal !== 'Unknown journal') {
    lines.push(`T2  - ${record.journal}`);
  }

  const abstract = record.abstract?.trim();
  if (abstract && abstract !== '(No abstract available)') {
    for (const para of abstract.split(/\r?\n/).filter(Boolean)) {
      lines.push(`AB  - ${para}`);
    }
  }

  if (record.year) lines.push(`PY  - ${record.year}`);
  if (record.doi) lines.push(`DO  - ${record.doi}`);
  if (record.l1Path) lines.push(`L1  - ${record.l1Path}`);

  lines.push('ER  -');
  return lines.join('\n');
}

export function exportRis(papers: ScreeningRecord[]): string {
  if (papers.length === 0) return '';
  return `${papers.map(recordToRis).join('\n\n')}\n`;
}

export type RisExportMode = 'any' | 'all';

/**
 * Papers marked include or maybe by reviewers.
 * - any: at least one reviewer said include/maybe (default for post-screening export)
 * - all: every reviewer who decided said include/maybe
 */
export function filterPapersForRisExport(
  papers: ScreeningRecord[],
  reviewerDecisions: Map<string, Map<string, DecisionRecord>>,
  mode: RisExportMode = 'any',
): ScreeningRecord[] {
  if (reviewerDecisions.size === 0) return [];

  return papers.filter((paper) => {
    const decisions = [...reviewerDecisions.values()]
      .map((m) => m.get(paper.id)?.decision)
      .filter((d): d is Decision => !!d);

    if (decisions.length === 0) return false;

    if (mode === 'any') {
      return decisions.some((d) => PASS_DECISIONS.has(d));
    }

    return decisions.every((d) => PASS_DECISIONS.has(d));
  });
}

export function downloadTextFile(content: string, filename: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
