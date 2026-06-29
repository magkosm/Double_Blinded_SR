import { describe, it, expect } from 'vitest';
import { parseRis } from './ris-parser';
import { exportRis, filterPapersForRisExport, recordToRis } from './ris-export';
import { decisionsToMap } from './screening';
import type { ScreeningRecord } from '../types';

const papers: ScreeningRecord[] = [
  { id: '1', title: 'Included paper', journal: 'J1', abstract: 'Abstract one.', year: 2024, doi: '10.1/inc' },
  { id: '2', title: 'Maybe paper', journal: 'J2', abstract: 'Abstract two.', year: 2023 },
  { id: '3', title: 'Excluded paper', journal: 'J3', abstract: 'Abstract three.' },
];

describe('recordToRis', () => {
  it('builds valid RIS block', () => {
    const ris = recordToRis(papers[0]!);
    expect(ris).toContain('TY  - JOUR');
    expect(ris).toContain('TI  - Included paper');
    expect(ris).toContain('DO  - 10.1/inc');
    expect(ris).toContain('ER  -');

    const parsed = parseRis(ris);
    expect(parsed[0]?.title).toBe('Included paper');
    expect(parsed[0]?.doi).toBe('10.1/inc');
  });
});

describe('filterPapersForRisExport', () => {
  it('includes papers with any reviewer include/maybe', () => {
    const reviewerDecisions = new Map([
      [
        'r1',
        decisionsToMap([
          { paperId: '1', decision: 'include', decidedAt: '2026-01-01' },
          { paperId: '2', decision: 'maybe', decidedAt: '2026-01-01' },
          { paperId: '3', decision: 'exclude', decidedAt: '2026-01-01' },
        ]),
      ],
    ]);

    const filtered = filterPapersForRisExport(papers, reviewerDecisions, 'any');
    expect(filtered.map((p) => p.id)).toEqual(['1', '2']);
  });

  it('requires all reviewers in all mode', () => {
    const reviewerDecisions = new Map([
      [
        'r1',
        decisionsToMap([{ paperId: '1', decision: 'include', decidedAt: '2026-01-01' }]),
      ],
      [
        'r2',
        decisionsToMap([{ paperId: '1', decision: 'exclude', decidedAt: '2026-01-01' }]),
      ],
    ]);

    expect(filterPapersForRisExport(papers, reviewerDecisions, 'any').map((p) => p.id)).toEqual(['1']);
    expect(filterPapersForRisExport(papers, reviewerDecisions, 'all')).toEqual([]);
  });
});

describe('exportRis', () => {
  it('joins multiple records', () => {
    const ris = exportRis([papers[0]!, papers[1]!]);
    expect(parseRis(ris)).toHaveLength(2);
  });
});
