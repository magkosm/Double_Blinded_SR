import { describe, expect, it } from 'vitest';
import { buildQueue, computeStats, decisionsToMap, exportCsv } from './screening';
import type { DecisionRecord, ScreeningRecord } from '../types';

const papers: ScreeningRecord[] = [
  { id: '1', title: 'Paper A', journal: 'J1', abstract: 'ab', year: 2024 },
  { id: '2', title: 'Paper B', journal: 'J2', abstract: 'ab', year: 2023 },
  { id: '3', title: 'Paper C', journal: 'J3', abstract: 'ab' },
];

describe('buildQueue', () => {
  it('returns undecided papers first', () => {
    const decisions = decisionsToMap([
      { paperId: '1', decision: 'include', decidedAt: '2026-01-01' },
    ]);
    const queue = buildQueue(papers, decisions);
    expect(queue.map((p) => p.id)).toEqual(['2', '3']);
  });

  it('returns skipped papers when all others decided', () => {
    const decisions = decisionsToMap([
      { paperId: '1', decision: 'include', decidedAt: '2026-01-01' },
      { paperId: '2', decision: 'exclude', decidedAt: '2026-01-01' },
      { paperId: '3', decision: 'skip', decidedAt: '2026-01-01' },
    ]);
    const queue = buildQueue(papers, decisions);
    expect(queue.map((p) => p.id)).toEqual(['3']);
  });
});

describe('computeStats', () => {
  it('counts decisions and pending', () => {
    const decisions = decisionsToMap([
      { paperId: '1', decision: 'include', decidedAt: '2026-01-01' },
      { paperId: '2', decision: 'exclude', decidedAt: '2026-01-01' },
    ]);
    const stats = computeStats(papers, decisions);
    expect(stats).toEqual({
      include: 1,
      exclude: 1,
      maybe: 0,
      skip: 0,
      pending: 1,
      total: 3,
    });
  });

  it('uses decision count when paper list empty', () => {
    const decisions = decisionsToMap([
      { paperId: '1', decision: 'include', decidedAt: '2026-01-01' },
      { paperId: '2', decision: 'maybe', decidedAt: '2026-01-01' },
    ]);
    const stats = computeStats([], decisions);
    expect(stats.total).toBe(2);
    expect(stats.include).toBe(1);
  });
});

describe('exportCsv', () => {
  it('escapes commas in titles', () => {
    const p: ScreeningRecord[] = [
      { id: '1', title: 'Hello, world', journal: 'J', abstract: '' },
    ];
    const csv = exportCsv(
      p,
      new Map([['r1', decisionsToMap([{ paperId: '1', decision: 'include', decidedAt: '2026-01-01' }])]]),
      new Map([['r1', 'alice']]),
    );
    expect(csv).toContain('"Hello, world"');
    expect(csv).toContain(',include');
  });
});
