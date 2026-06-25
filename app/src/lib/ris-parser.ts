import type { ScreeningRecord } from '../types';

const TAG_LINE = /^([A-Z0-9]{2})  - (.*)$/;

function extractScopusId(url: string): string | null {
  const match = url.match(/publications\/(\d+)/);
  return match ? `scopus:${match[1]}` : null;
}

function normalizeDoi(doi: string): string {
  return doi.replace(/^https?:\/\/doi\.org\//i, '').trim().toLowerCase();
}

function makeId(record: Partial<ScreeningRecord> & { ur?: string }): string {
  if (record.doi) return `doi:${normalizeDoi(record.doi)}`;
  if (record.ur) {
    const scopusId = extractScopusId(record.ur);
    if (scopusId) return scopusId;
  }
  const slug = [record.title, record.year?.toString()]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80);
  return `hash:${slug}`;
}

export function parseRis(content: string): ScreeningRecord[] {
  const records: ScreeningRecord[] = [];
  const blocks = content.split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) continue;

    let ty = '';
    let title = '';
    let journal = '';
    let abstract = '';
    let year: number | undefined;
    let doi = '';
    let ur = '';

    for (const line of lines) {
      const match = line.match(TAG_LINE);
      if (!match) continue;
      const [, tag, value] = match;
      const v = value.trim();
      switch (tag) {
        case 'TY':
          ty = v;
          break;
        case 'TI':
          title = v;
          break;
        case 'T2':
          journal = v;
          break;
        case 'AB':
          abstract = v;
          break;
        case 'PY':
          year = parseInt(v, 10) || undefined;
          break;
        case 'DO':
          doi = v;
          break;
        case 'UR':
          ur = v;
          break;
      }
    }

    if (ty !== 'JOUR' || !title) continue;

    const record: ScreeningRecord = {
      id: makeId({ title, year, doi: doi || undefined, ur: ur || undefined }),
      title,
      journal: journal || 'Unknown journal',
      abstract: abstract || '(No abstract available)',
      year,
      doi: doi || undefined,
    };
    records.push(record);
  }

  const seen = new Set<string>();
  return records.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
