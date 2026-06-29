import { describe, expect, it } from 'vitest';
import { dedupeKeyFor, mergeRisRecords, normalizeDoi } from './dedupe';
import type { ScreeningRecord } from '../types';

describe('dedupe', () => {
  it('normalizes DOI', () => {
    expect(normalizeDoi('10.1234/abc')).toBe('10.1234/abc');
    expect(normalizeDoi('https://doi.org/10.1234/ABC')).toBe('10.1234/abc');
  });

  it('dedupes by DOI', () => {
    const existing: ScreeningRecord[] = [
      { id: '1', title: 'A', journal: 'J', abstract: '', doi: '10.1/a' },
    ];
    const incoming: ScreeningRecord[] = [
      { id: '2', title: 'A copy', journal: 'J', abstract: '', doi: '10.1/a' },
    ];
    const result = mergeRisRecords(existing, incoming, 'batch2');
    expect(result.added).toBe(0);
    expect(result.duplicates).toBe(1);
    expect(result.merged).toHaveLength(1);
  });

  it('dedupes by title+year when no DOI', () => {
    const existing: ScreeningRecord[] = [
      { id: '1', title: 'Hello World', journal: 'J', abstract: '', year: 2024 },
    ];
    const incoming: ScreeningRecord[] = [
      { id: '2', title: 'Hello, World!', journal: 'J2', abstract: '', year: 2024 },
    ];
    const result = mergeRisRecords(existing, incoming, 'b');
    expect(result.duplicates).toBe(1);
  });

  it('dedupeKeyFor prefers DOI', () => {
    expect(dedupeKeyFor({ title: 'T', doi: '10.1/x' })).toBe('doi:10.1/x');
  });
});
