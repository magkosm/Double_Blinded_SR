import type { Env, ReviewerRecord } from './types';
import { GLOBAL_KEYS, DEFAULT_REVIEW_SLUG, reviewKeys } from './keys';
import { json } from './util';
import { hashPassword } from './auth';

function keysFor(slug: string) {
  return reviewKeys(slug);
}

async function getReviewerIds(env: Env, slug: string): Promise<string[]> {
  const keys = keysFor(slug);
  let idsRaw = await env.KV.get(keys.reviewers);
  if (!idsRaw && slug === DEFAULT_REVIEW_SLUG) {
    idsRaw = await env.KV.get(GLOBAL_KEYS.legacyReviewers);
  }
  return idsRaw ? JSON.parse(idsRaw) : [];
}

async function getReviewerRecord(env: Env, slug: string, id: string): Promise<ReviewerRecord | null> {
  const keys = keysFor(slug);
  let raw = await env.KV.get(keys.reviewer(id));
  if (!raw && slug === DEFAULT_REVIEW_SLUG) {
    raw = await env.KV.get(GLOBAL_KEYS.legacyReviewer(id));
  }
  return raw ? (JSON.parse(raw) as ReviewerRecord) : null;
}

export async function handleListReviewers(env: Env, slug: string): Promise<Response> {
  const ids = await getReviewerIds(env, slug);
  const reviewers = [];
  for (const id of ids) {
    const r = await getReviewerRecord(env, slug, id);
    if (!r) {
      reviewers.push({ id, username: `(orphan ${id.slice(0, 8)}…)`, createdAt: '', missing: true });
      continue;
    }
    reviewers.push({ id: r.id, username: r.username, createdAt: r.createdAt });
  }
  return json(reviewers);
}

export async function handleGetReviewer(env: Env, slug: string, id: string): Promise<Response> {
  const r = await getReviewerRecord(env, slug, id);
  if (!r) return json({ error: 'Not found' }, 404);
  return json({
    id: r.id,
    username: r.username,
    createdAt: r.createdAt,
    wrappedProjectKey: r.wrappedProjectKey,
  });
}

export async function handleCreateReviewer(
  request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  const body = (await request.json()) as {
    username: string;
    password: string;
    wrappedProjectKey: ReviewerRecord['wrappedProjectKey'];
  };
  const keys = keysFor(slug);
  const ids = await getReviewerIds(env, slug);

  for (const id of ids) {
    const raw = await env.KV.get(keys.reviewer(id));
    if (!raw) continue;
    const r = JSON.parse(raw) as ReviewerRecord;
    if (r.username === body.username) return json({ error: 'Username taken' }, 409);
  }

  const id = crypto.randomUUID();
  const reviewer: ReviewerRecord = {
    id,
    username: body.username,
    passwordHash: await hashPassword(body.password),
    wrappedProjectKey: body.wrappedProjectKey,
    createdAt: new Date().toISOString(),
  };
  await env.KV.put(keys.reviewer(id), JSON.stringify(reviewer));
  ids.push(id);
  await env.KV.put(keys.reviewers, JSON.stringify(ids));
  return json({ id, username: body.username, password: body.password });
}

export async function handleDeleteReviewer(env: Env, slug: string, id: string): Promise<Response> {
  const keys = keysFor(slug);
  const ids = await getReviewerIds(env, slug);
  await env.KV.delete(keys.reviewer(id));
  await env.KV.delete(keys.decisions(id));
  await env.KV.put(keys.reviewers, JSON.stringify(ids.filter((i) => i !== id)));
  return json({ ok: true });
}

export async function handleResetReviewerPassword(
  request: Request,
  env: Env,
  slug: string,
  id: string,
): Promise<Response> {
  const keys = keysFor(slug);
  let raw = await env.KV.get(keys.reviewer(id));
  if (!raw && slug === DEFAULT_REVIEW_SLUG) {
    raw = await env.KV.get(GLOBAL_KEYS.legacyReviewer(id));
  }
  if (!raw) return json({ error: 'Not found' }, 404);

  const body = (await request.json()) as { password?: string };
  const password = body.password?.trim() || generatePassword();
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

  const reviewer = JSON.parse(raw) as ReviewerRecord;
  reviewer.passwordHash = await hashPassword(password);
  await env.KV.put(keys.reviewer(id), JSON.stringify(reviewer));
  return json({ ok: true, username: reviewer.username, password });
}

function generatePassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function handleGetDecisions(env: Env, slug: string, reviewerId: string): Promise<Response> {
  const keys = keysFor(slug);
  let raw = await env.KV.get(keys.decisions(reviewerId));
  if (!raw && slug === DEFAULT_REVIEW_SLUG) {
    raw = await env.KV.get(GLOBAL_KEYS.legacyDecisions(reviewerId));
  }
  if (!raw) return json({ error: 'No decisions' }, 404);
  return new Response(raw, { headers: { 'Content-Type': 'application/json' } });
}

export async function handlePutDecisions(
  request: Request,
  env: Env,
  slug: string,
  reviewerId: string,
): Promise<Response> {
  const body = await request.json();
  await env.KV.put(keysFor(slug).decisions(reviewerId), JSON.stringify(body));
  return json({ ok: true });
}

export async function handleGetFulltextNotes(
  env: Env,
  slug: string,
  reviewerId: string,
  paperId: string,
): Promise<Response> {
  const raw = await env.KV.get(keysFor(slug).fulltextNotes(reviewerId, paperId));
  if (!raw) return json({ error: 'Not found' }, 404);
  return new Response(raw, { headers: { 'Content-Type': 'application/json' } });
}

export async function handlePutFulltextNotes(
  request: Request,
  env: Env,
  slug: string,
  reviewerId: string,
  paperId: string,
): Promise<Response> {
  const body = await request.json();
  await env.KV.put(keysFor(slug).fulltextNotes(reviewerId, paperId), JSON.stringify(body));
  return json({ ok: true });
}
