import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseRis } from './ris-parser';

const RIS_PATH = resolve(
  __dirname,
  '../../../scopus_export_Jun 18-2026_642141a5-a34e-4acb-aa31-eb18be0a94ea/scopus_export_Jun 18-2026_642141a5-a34e-4acb-aa31-eb18be0a94ea.ris',
);

describe('parseRis', () => {
  it('parses sample RIS block', () => {
    const sample = `TY  - JOUR
TI  - Test Paper Title
T2  - Journal of Testing
AB  - This is an abstract.
PY  - 2024
DO  - 10.1000/test.2024
UR  - https://www.scopus.com/pages/publications/123456789?origin=resultslist
ER  -`;

    const records = parseRis(sample);
    expect(records).toHaveLength(1);
    expect(records[0].title).toBe('Test Paper Title');
    expect(records[0].journal).toBe('Journal of Testing');
    expect(records[0].abstract).toBe('This is an abstract.');
    expect(records[0].year).toBe(2024);
    expect(records[0].doi).toBe('10.1000/test.2024');
    expect(records[0].id).toBe('doi:10.1000/test.2024');
  });

  it('uses Scopus ID when DOI missing', () => {
    const sample = `TY  - JOUR
TI  - No DOI Paper
T2  - Some Journal
AB  - Abstract here.
UR  - https://www.scopus.com/pages/publications/999888777?origin=resultslist
ER  -`;

    const records = parseRis(sample);
    expect(records[0].id).toBe('scopus:999888777');
  });

  it('parses full Scopus export with 786 records', () => {
    let content: string;
    try {
      content = readFileSync(RIS_PATH, 'utf-8');
    } catch {
      console.warn('RIS file not found locally, skipping integration test');
      return;
    }

    const records = parseRis(content);
    expect(records.length).toBe(786);
    expect(records.every((r) => r.title && r.journal && r.abstract)).toBe(true);
    expect(records.every((r) => r.id)).toBe(true);
    const ids = new Set(records.map((r) => r.id));
    expect(ids.size).toBe(records.length);
  });
});
