import type { Env } from './types';
import { GLOBAL_KEYS, DEFAULT_REVIEW_SLUG, reviewKeys } from './keys';
import { json } from './util';

/** Progress counts — operates on encrypted decision blob sizes / counts only when admin decrypts client-side.
 *  Server returns reviewer ids and raw encrypted payloads for admin client-side aggregation.
 */
export async function handleGetProgress(env: Env, slug: string): Promise<Response> {
  const keys = reviewKeys(slug);
  let idsRaw = await env.KV.get(keys.reviewers);
  if (!idsRaw && slug === DEFAULT_REVIEW_SLUG) {
    idsRaw = await env.KV.get(GLOBAL_KEYS.legacyReviewers);
  }
  const reviewerIds: string[] = idsRaw ? JSON.parse(idsRaw) : [];

  const batchesRaw = await env.KV.get(keys.risBatches);
  const batches = batchesRaw ? JSON.parse(batchesRaw) : [];

  const reviewers = [];
  for (const id of reviewerIds) {
    let decRaw = await env.KV.get(keys.decisions(id));
    if (!decRaw && slug === DEFAULT_REVIEW_SLUG) {
      decRaw = await env.KV.get(GLOBAL_KEYS.legacyDecisions(id));
    }
    reviewers.push({
      id,
      hasDecisions: !!decRaw,
      payloadSize: decRaw ? decRaw.length : 0,
    });
  }

  const statsRaw = await env.KV.get(keys.stats);
  const stats = statsRaw ? JSON.parse(statsRaw) : null;

  return json({
    slug,
    reviewerCount: reviewerIds.length,
    reviewers,
    risBatchCount: batches.length,
    batches,
    usageStats: stats,
  });
}

/** Conflict detection requires decrypted decisions — admin client sends paper decision map for server-side compare
 *  or we accept encrypted payloads and compare on client. Server endpoint accepts pre-computed conflict ids from admin.
 *  For privacy, we provide an endpoint that accepts arrays of paperIds per reviewer (hashed ids only) from admin client.
 */
export async function handlePostConflicts(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    reviewers: { id: string; decisions: Record<string, string> }[];
  };
  const paperIds = new Set<string>();
  for (const r of body.reviewers) {
    for (const pid of Object.keys(r.decisions)) paperIds.add(pid);
  }

  const conflicts: { paperId: string; decisions: Record<string, string> }[] = [];
  for (const paperId of paperIds) {
    const map: Record<string, string> = {};
    for (const r of body.reviewers) {
      if (r.decisions[paperId]) map[r.id] = r.decisions[paperId];
    }
    const values = new Set(Object.values(map));
    if (Object.keys(map).length >= 2 && values.size > 1) {
      conflicts.push({ paperId, decisions: map });
    }
  }
  return json({ conflicts, count: conflicts.length });
}

export async function handleGetGlobalOverview(env: Env): Promise<Response> {
  const listRaw = await env.KV.get(GLOBAL_KEYS.reviewList);
  const slugs: string[] = listRaw ? JSON.parse(listRaw) : [DEFAULT_REVIEW_SLUG];
  const overview = [];
  for (const slug of slugs) {
    const metaRaw = await env.KV.get(reviewKeys(slug).meta);
    if (!metaRaw) continue;
    const meta = JSON.parse(metaRaw);
    const progressRes = await handleGetProgress(env, slug);
    const progress = await progressRes.json();
    overview.push({ ...meta, progress });
  }
  return json(overview);
}
