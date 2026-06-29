/**
 * Merge and dedupe RIS records across batches.
 * Primary key: normalized DOI; fallback: normalized title + year.
 */

import type { ScreeningRecord } from '../types';

export function normalizeDoi(doi?: string): string | null {
  if (!doi) return null;
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/doi\.org\//i, '')
    .replace(/^doi:/i, '');
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function dedupeKeyFor(record: Pick<ScreeningRecord, 'title' | 'year' | 'doi'>): string {
  const doi = normalizeDoi(record.doi);
  if (doi) return `doi:${doi}`;
  const title = normalizeTitle(record.title);
  const year = record.year ?? 0;
  return `ty:${title}|${year}`;
}

export type MergeResult = {
  merged: ScreeningRecord[];
  added: number;
  duplicates: number;
  failed: number;
  totalInFile: number;
};

export function mergeRisRecords(
  existing: ScreeningRecord[],
  incoming: ScreeningRecord[],
  batchId: string,
): MergeResult {
  const index = new Map<string, ScreeningRecord>();
  for (const p of existing) {
    index.set(p.dedupeKey || dedupeKeyFor(p), p);
  }

  let added = 0;
  let duplicates = 0;
  let failed = 0;

  for (const record of incoming) {
    if (!record.title?.trim()) {
      failed++;
      continue;
    }
    const key = dedupeKeyFor(record);
    if (index.has(key)) {
      duplicates++;
      continue;
    }
    const enriched: ScreeningRecord = {
      ...record,
      dedupeKey: key,
      sourceBatchId: batchId,
      externalIds: { doi: normalizeDoi(record.doi) || undefined },
    };
    index.set(key, enriched);
    added++;
  }

  return {
    merged: [...index.values()],
    added,
    duplicates,
    failed,
    totalInFile: incoming.length,
  };
}

export function findNearDuplicates(records: ScreeningRecord[]): { a: string; b: string }[] {
  const pairs: { a: string; b: string }[] = [];
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i]!;
      const b = records[j]!;
      if (a.dedupeKey === b.dedupeKey) continue;
      const ta = normalizeTitle(a.title);
      const tb = normalizeTitle(b.title);
      if (ta === tb && a.year === b.year) {
        pairs.push({ a: a.id, b: b.id });
      }
    }
  }
  return pairs;
}
