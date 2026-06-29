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

function appendField(fields: Record<string, string>, tag: string, value: string) {
  if (fields[tag]) fields[tag] += `\n${value}`;
  else fields[tag] = value;
}

const MULTILINE_TAGS = new Set(['AB', 'TI', 'T2', 'N1', 'KW']);

export function parseRis(content: string): ScreeningRecord[] {
  const records: ScreeningRecord[] = [];
  const blocks = content.split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) continue;

    const fields: Record<string, string> = {};
    let lastTag = '';

    for (const line of lines) {
      const match = line.match(TAG_LINE);
      if (match) {
        const [, tag, value] = match;
        lastTag = tag;
        appendField(fields, tag, value.trim());
      } else if (line.trim() && lastTag && MULTILINE_TAGS.has(lastTag)) {
        appendField(fields, lastTag, line.trim());
      }
    }

    const ty = fields.TY || '';
    const title = fields.TI || '';
    if (ty !== 'JOUR' || !title) continue;

    const journal =
      fields.T2?.trim() ||
      fields.JO?.trim() ||
      fields.JF?.trim() ||
      fields.T3?.trim() ||
      fields.JA?.trim() ||
      '';

    const abstract = fields.AB?.trim() || '';
    const year = fields.PY ? parseInt(fields.PY, 10) || undefined : undefined;
    const doi = fields.DO?.trim() || '';
    const ur = fields.UR?.trim() || '';

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
