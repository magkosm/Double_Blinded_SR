import type { Env, RisBatch, BucketConfig, CustomFieldSchema, UsageStats } from './types';
import { GLOBAL_KEYS, DEFAULT_REVIEW_SLUG, reviewKeys } from './keys';
import { json } from './util';

function keysFor(slug: string) {
  return reviewKeys(slug);
}

export async function handleGetPapers(env: Env, slug: string): Promise<Response> {
  const keys = keysFor(slug);
  let raw = await env.KV.get(keys.papers);
  if (!raw && slug === DEFAULT_REVIEW_SLUG) {
    raw = await env.KV.get(GLOBAL_KEYS.legacyPapers);
  }
  if (!raw) return json({ error: 'No papers uploaded' }, 404);
  return new Response(raw, { headers: { 'Content-Type': 'application/json' } });
}

export async function handlePutPapers(request: Request, env: Env, slug: string): Promise<Response> {
  const body = await request.json();
  await env.KV.put(keysFor(slug).papers, JSON.stringify(body));
  return json({ ok: true });
}

export async function handleGetRubric(env: Env, slug: string): Promise<Response> {
  const keys = keysFor(slug);
  let raw = await env.KV.get(keys.rubric);
  if (!raw && slug === DEFAULT_REVIEW_SLUG) {
    raw = await env.KV.get(GLOBAL_KEYS.legacyRubric);
  }
  if (!raw) return json({ error: 'No rubric configured' }, 404);
  return new Response(raw, { headers: { 'Content-Type': 'application/json' } });
}

export async function handlePutRubric(request: Request, env: Env, slug: string): Promise<Response> {
  const body = await request.json();
  await env.KV.put(keysFor(slug).rubric, JSON.stringify(body));
  return json({ ok: true });
}

export async function handleListRisBatches(env: Env, slug: string): Promise<Response> {
  const raw = await env.KV.get(keysFor(slug).risBatches);
  return json(raw ? (JSON.parse(raw) as RisBatch[]) : []);
}

export async function handlePutRisBatches(request: Request, env: Env, slug: string): Promise<Response> {
  const body = await request.json();
  await env.KV.put(keysFor(slug).risBatches, JSON.stringify(body));
  return json({ ok: true });
}

export async function handleGetBuckets(env: Env, slug: string): Promise<Response> {
  const raw = await env.KV.get(keysFor(slug).buckets);
  const config: BucketConfig = raw
    ? JSON.parse(raw)
    : { labels: ['Off topic', 'Wrong subject population'] };
  return json(config);
}

export async function handlePutBuckets(request: Request, env: Env, slug: string): Promise<Response> {
  const body = await request.json();
  await env.KV.put(keysFor(slug).buckets, JSON.stringify(body));
  return json({ ok: true });
}

export async function handleGetCustomFields(env: Env, slug: string): Promise<Response> {
  const raw = await env.KV.get(keysFor(slug).customFields);
  const schema: CustomFieldSchema = raw ? JSON.parse(raw) : { columns: [] };
  return json(schema);
}

export async function handlePutCustomFields(request: Request, env: Env, slug: string): Promise<Response> {
  const body = await request.json();
  await env.KV.put(keysFor(slug).customFields, JSON.stringify(body));
  return json({ ok: true });
}

export async function handleGetStats(env: Env, slug: string): Promise<Response> {
  const raw = await env.KV.get(keysFor(slug).stats);
  const stats: UsageStats = raw
    ? JSON.parse(raw)
    : {
        logins: 0,
        decisions: { include: 0, exclude: 0, maybe: 0, skip: 0 },
        undos: 0,
        papersScreened: 0,
        updatedAt: new Date().toISOString(),
      };
  return json(stats);
}

export async function handlePatchStats(request: Request, env: Env, slug: string): Promise<Response> {
  const raw = await env.KV.get(keysFor(slug).stats);
  const stats: UsageStats = raw
    ? JSON.parse(raw)
    : {
        logins: 0,
        decisions: { include: 0, exclude: 0, maybe: 0, skip: 0 },
        undos: 0,
        papersScreened: 0,
        updatedAt: new Date().toISOString(),
      };
  const patch = (await request.json()) as Partial<UsageStats> & {
    decisionType?: keyof UsageStats['decisions'];
  };
  if (patch.logins) stats.logins += patch.logins;
  if (patch.undos) stats.undos += patch.undos;
  if (patch.papersScreened) stats.papersScreened += patch.papersScreened;
  if (patch.decisionType) stats.decisions[patch.decisionType]++;
  stats.updatedAt = new Date().toISOString();
  await env.KV.put(keysFor(slug).stats, JSON.stringify(stats));
  return json(stats);
}

export async function handleUploadPdf(
  request: Request,
  env: Env,
  slug: string,
  paperId: string,
): Promise<Response> {
  if (!env.PDF_BUCKET) return json({ error: 'PDF storage not configured' }, 503);
  const url = new URL(request.url);
  const filename = url.searchParams.get('filename') || 'document.pdf';
  const key = `${slug}/${paperId}/${filename}`;
  const body = await request.arrayBuffer();
  await env.PDF_BUCKET.put(key, body, {
    httpMetadata: { contentType: 'application/pdf' },
  });
  await env.KV.put(keysFor(slug).pdfMeta(paperId), JSON.stringify({ key, filename }));
  return json({ ok: true, key });
}

export async function handleGetPdf(env: Env, slug: string, paperId: string): Promise<Response> {
  if (!env.PDF_BUCKET) return json({ error: 'PDF storage not configured' }, 503);
  const metaRaw = await env.KV.get(keysFor(slug).pdfMeta(paperId));
  if (!metaRaw) return json({ error: 'PDF not found' }, 404);
  const meta = JSON.parse(metaRaw) as { key: string; filename: string };
  const obj = await env.PDF_BUCKET.get(meta.key);
  if (!obj) return json({ error: 'PDF not found' }, 404);
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${meta.filename}"`,
    },
  });
}

export async function handlePutPdfMeta(request: Request, env: Env, slug: string, paperId: string) {
  const body = await request.json();
  await env.KV.put(keysFor(slug).pdfMeta(paperId), JSON.stringify(body));
  return json({ ok: true });
}
