import type { Env, ReviewMeta, SuperAdminRecord, AdminRecord } from './types';
import { GLOBAL_KEYS, DEFAULT_REVIEW_SLUG, reviewKeys } from './keys';
import { json, slugValid } from './util';
import {
  appendAudit,
  hashPassword,
  isSuperAdmin,
  signJwt,
  verifyPassword,
} from './auth';

export async function handleBootstrap(request: Request, env: Env): Promise<Response> {
  const existing = await env.KV.get(GLOBAL_KEYS.superAdmin);
  if (existing) return json({ error: 'Already bootstrapped' }, 409);

  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (token !== env.BOOTSTRAP_TOKEN) return json({ error: 'Invalid bootstrap token' }, 403);

  const body = (await request.json()) as { username: string; password: string };
  if (!body.username || !body.password) return json({ error: 'Missing credentials' }, 400);

  const passwordHash = await hashPassword(body.password);
  const admin: SuperAdminRecord = { username: body.username, passwordHash };
  await env.KV.put(GLOBAL_KEYS.superAdmin, JSON.stringify(admin));
  await ensureDefaultReview(env, body.username);

  return json({ ok: true, username: body.username, role: 'super_admin' });
}

/** One-time upgrade: copy legacy auth:admin → auth:super_admin (bootstrap token required). */
export async function handleUpgradeSuperAdmin(request: Request, env: Env): Promise<Response> {
  const existing = await env.KV.get(GLOBAL_KEYS.superAdmin);
  if (existing) return json({ ok: true, message: 'Super-admin already configured' });

  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (token !== env.BOOTSTRAP_TOKEN) return json({ error: 'Invalid bootstrap token' }, 403);

  const legacyRaw = await env.KV.get(GLOBAL_KEYS.legacyAdmin);
  if (!legacyRaw) return json({ error: 'No legacy admin to upgrade' }, 404);

  await env.KV.put(GLOBAL_KEYS.superAdmin, legacyRaw);
  const legacy = JSON.parse(legacyRaw) as AdminRecord;
  await ensureDefaultReview(env, legacy.username);
  await appendAudit(env, DEFAULT_REVIEW_SLUG, 'super_admin_upgraded', legacy.username);

  return json({ ok: true, upgraded: true, username: legacy.username });
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    username: string;
    password: string;
    role: string;
    reviewSlug?: string;
  };

  const role = body.role === 'admin' ? 'review_admin' : body.role;
  const slug = body.reviewSlug || DEFAULT_REVIEW_SLUG;

  if (role === 'super_admin' || (role === 'review_admin' && !body.reviewSlug)) {
    const raw = await env.KV.get(GLOBAL_KEYS.superAdmin);
    if (raw) {
      const admin = JSON.parse(raw) as SuperAdminRecord;
      if (admin.username === body.username && (await verifyPassword(body.password, admin.passwordHash))) {
        const token = await signJwt(env, {
          sub: 'super_admin',
          username: admin.username,
          role: 'super_admin',
        });
        return json({
          token,
          role: 'super_admin',
          userId: 'super_admin',
          username: admin.username,
        });
      }
    }
    // Legacy admin: super-admin login until auth:super_admin is migrated
    const legacyRaw = await env.KV.get(GLOBAL_KEYS.legacyAdmin);
    if (legacyRaw && role === 'super_admin' && !raw) {
      const admin = JSON.parse(legacyRaw) as AdminRecord;
      if (admin.username === body.username && (await verifyPassword(body.password, admin.passwordHash))) {
        await ensureDefaultReview(env, admin.username);
        const token = await signJwt(env, {
          sub: 'super_admin',
          username: admin.username,
          role: 'super_admin',
        });
        return json({
          token,
          role: 'super_admin',
          userId: 'super_admin',
          username: admin.username,
        });
      }
    }
    // Legacy single admin fallback → review admin on default review
    if (legacyRaw && role !== 'super_admin') {
      const admin = JSON.parse(legacyRaw) as AdminRecord;
      if (admin.username === body.username && (await verifyPassword(body.password, admin.passwordHash))) {
        await ensureDefaultReview(env, admin.username);
        const token = await signJwt(env, {
          sub: 'admin',
          username: admin.username,
          role: 'review_admin',
          reviewSlug: DEFAULT_REVIEW_SLUG,
        });
        return json({
          token,
          role: 'review_admin',
          userId: 'admin',
          username: admin.username,
          reviewSlug: DEFAULT_REVIEW_SLUG,
        });
      }
    }
    if (role === 'super_admin') return json({ error: 'Invalid credentials' }, 401);
  }

  if (role === 'review_admin') {
    if (!slugValid(slug)) return json({ error: 'Invalid review slug' }, 400);
    const keys = reviewKeys(slug);
    const raw = await env.KV.get(keys.admin);
    if (!raw) return json({ error: 'Review not found' }, 404);
    const admin = JSON.parse(raw) as AdminRecord;
    if (admin.username !== body.username) return json({ error: 'Invalid credentials' }, 401);
    if (!(await verifyPassword(body.password, admin.passwordHash))) {
      return json({ error: 'Invalid credentials' }, 401);
    }
    const token = await signJwt(env, {
      sub: `admin:${slug}`,
      username: admin.username,
      role: 'review_admin',
      reviewSlug: slug,
    });
    return json({
      token,
      role: 'review_admin',
      userId: `admin:${slug}`,
      username: admin.username,
      reviewSlug: slug,
    });
  }

  if (role === 'reviewer') {
    if (!slugValid(slug)) return json({ error: 'Invalid review slug' }, 400);
    const keys = reviewKeys(slug);
    let idsRaw = await env.KV.get(keys.reviewers);
    let ids: string[] = idsRaw ? JSON.parse(idsRaw) : [];

    // Legacy fallback
    if (ids.length === 0 && slug === DEFAULT_REVIEW_SLUG) {
      const legacyIds = await env.KV.get(GLOBAL_KEYS.legacyReviewers);
      ids = legacyIds ? JSON.parse(legacyIds) : [];
    }

    for (const id of ids) {
      let raw = await env.KV.get(keys.reviewer(id));
      if (!raw && slug === DEFAULT_REVIEW_SLUG) {
        raw = await env.KV.get(GLOBAL_KEYS.legacyReviewer(id));
      }
      if (!raw) continue;
      const reviewer = JSON.parse(raw) as { id: string; username: string; passwordHash: string };
      if (reviewer.username !== body.username) continue;
      if (!(await verifyPassword(body.password, reviewer.passwordHash))) {
        return json({ error: 'Invalid credentials' }, 401);
      }
      const token = await signJwt(env, {
        sub: id,
        username: reviewer.username,
        role: 'reviewer',
        reviewSlug: slug,
      });
      return json({
        token,
        role: 'reviewer',
        userId: id,
        username: reviewer.username,
        reviewSlug: slug,
      });
    }
  }

  return json({ error: 'Invalid credentials' }, 401);
}

export async function handleListReviews(env: Env): Promise<Response> {
  const raw = await env.KV.get(GLOBAL_KEYS.reviewList);
  const slugs: string[] = raw ? JSON.parse(raw) : [];
  const reviews: ReviewMeta[] = [];
  for (const slug of slugs) {
    const metaRaw = await env.KV.get(reviewKeys(slug).meta);
    if (metaRaw) reviews.push(JSON.parse(metaRaw) as ReviewMeta);
  }
  return json(reviews);
}

export async function handleCreateReview(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { name: string; slug: string };
  if (!body.name || !body.slug || !slugValid(body.slug)) {
    return json({ error: 'Invalid name or slug' }, 400);
  }

  const keys = reviewKeys(body.slug);
  if (await env.KV.get(keys.meta)) return json({ error: 'Slug taken' }, 409);

  const meta: ReviewMeta = {
    id: crypto.randomUUID(),
    name: body.name,
    slug: body.slug,
    createdAt: new Date().toISOString(),
    stageConfig: { stage1Mode: 'title_abstract', stage2Enabled: false },
  };
  await env.KV.put(keys.meta, JSON.stringify(meta));

  const listRaw = await env.KV.get(GLOBAL_KEYS.reviewList);
  const slugs: string[] = listRaw ? JSON.parse(listRaw) : [];
  slugs.push(body.slug);
  await env.KV.put(GLOBAL_KEYS.reviewList, JSON.stringify(slugs));

  await appendAudit(env, body.slug, 'review_created', body.name);
  return json(meta);
}

export async function handleDeleteReview(env: Env, slug: string): Promise<Response> {
  const keys = reviewKeys(slug);
  await env.KV.delete(keys.meta);
  await env.KV.delete(keys.admin);
  await env.KV.delete(keys.papers);
  await env.KV.delete(keys.rubric);
  await env.KV.delete(keys.risBatches);

  const listRaw = await env.KV.get(GLOBAL_KEYS.reviewList);
  const slugs: string[] = listRaw ? JSON.parse(listRaw) : [];
  await env.KV.put(GLOBAL_KEYS.reviewList, JSON.stringify(slugs.filter((s) => s !== slug)));
  return json({ ok: true });
}

export async function handleBootstrapReviewAdmin(
  request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  const keys = reviewKeys(slug);
  if (!(await env.KV.get(keys.meta))) return json({ error: 'Review not found' }, 404);
  if (await env.KV.get(keys.admin)) return json({ error: 'Review admin already exists' }, 409);

  const body = (await request.json()) as { username: string; password: string };
  if (!body.username || !body.password) return json({ error: 'Missing credentials' }, 400);

  const admin: AdminRecord = { username: body.username, passwordHash: await hashPassword(body.password) };
  await env.KV.put(keys.admin, JSON.stringify(admin));
  await appendAudit(env, slug, 'review_admin_bootstrapped', body.username);
  return json({ ok: true, username: body.username });
}

export async function handleGetReviewAdmin(env: Env, slug: string): Promise<Response> {
  const raw = await env.KV.get(reviewKeys(slug).admin);
  if (!raw) return json({ error: 'No review admin' }, 404);
  const admin = JSON.parse(raw) as AdminRecord;
  return json({ username: admin.username });
}

export async function handleResetReviewAdminPassword(
  request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  const keys = reviewKeys(slug);
  const raw = await env.KV.get(keys.admin);
  if (!raw) return json({ error: 'No review admin' }, 404);

  const body = (await request.json()) as { password?: string };
  const password = body.password?.trim() || randomPassword();
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

  const admin = JSON.parse(raw) as AdminRecord;
  admin.passwordHash = await hashPassword(password);
  await env.KV.put(keys.admin, JSON.stringify(admin));
  await appendAudit(env, slug, 'review_admin_password_reset', admin.username);
  return json({ ok: true, username: admin.username, password });
}

export async function handleListAllUsers(env: Env): Promise<Response> {
  const listRaw = await env.KV.get(GLOBAL_KEYS.reviewList);
  const slugs: string[] = listRaw ? JSON.parse(listRaw) : [];
  const reviews = [];

  for (const slug of slugs) {
    const keys = reviewKeys(slug);
    const metaRaw = await env.KV.get(keys.meta);
    if (!metaRaw) continue;
    const meta = JSON.parse(metaRaw) as ReviewMeta;

    let adminUsername: string | null = null;
    const adminRaw = await env.KV.get(keys.admin);
    if (adminRaw) adminUsername = (JSON.parse(adminRaw) as AdminRecord).username;

    const idsRaw = await env.KV.get(keys.reviewers);
    let ids: string[] = idsRaw ? JSON.parse(idsRaw) : [];
    if (ids.length === 0 && slug === DEFAULT_REVIEW_SLUG) {
      const legacyRaw = await env.KV.get(GLOBAL_KEYS.legacyReviewers);
      ids = legacyRaw ? JSON.parse(legacyRaw) : [];
    }
    const reviewers = [];
    for (const id of ids) {
      let rRaw = await env.KV.get(keys.reviewer(id));
      if (!rRaw && slug === DEFAULT_REVIEW_SLUG) {
        rRaw = await env.KV.get(GLOBAL_KEYS.legacyReviewer(id));
      }
      if (!rRaw) {
        reviewers.push({ id, username: `(orphan ${id.slice(0, 8)}…)`, createdAt: '' });
        continue;
      }
      const r = JSON.parse(rRaw) as { id: string; username: string; createdAt: string };
      reviewers.push({ id: r.id, username: r.username, createdAt: r.createdAt });
    }

    reviews.push({
      slug,
      name: meta.name,
      adminUsername,
      reviewers,
    });
  }

  const superRaw = await env.KV.get(GLOBAL_KEYS.superAdmin);
  const superAdmin = superRaw ? (JSON.parse(superRaw) as AdminRecord).username : null;

  return json({ superAdmin, reviews });
}

function randomPassword(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function handleGetReviewMeta(env: Env, slug: string): Promise<Response> {
  const raw = await env.KV.get(reviewKeys(slug).meta);
  if (!raw) return json({ error: 'Not found' }, 404);
  return new Response(raw, { headers: { 'Content-Type': 'application/json' } });
}

export async function handleUpdateReviewMeta(request: Request, env: Env, slug: string): Promise<Response> {
  const keys = reviewKeys(slug);
  const raw = await env.KV.get(keys.meta);
  if (!raw) return json({ error: 'Not found' }, 404);
  const meta = JSON.parse(raw) as ReviewMeta;
  const patch = (await request.json()) as Partial<ReviewMeta>;
  if (patch.stageConfig) meta.stageConfig = { ...meta.stageConfig, ...patch.stageConfig };
  if (patch.name) meta.name = patch.name;
  await env.KV.put(keys.meta, JSON.stringify(meta));
  return json(meta);
}

export async function handleGetReviewMetaPublic(env: Env, slug: string): Promise<Response> {
  const raw = await env.KV.get(reviewKeys(slug).meta);
  if (!raw) return json({ error: 'Not found' }, 404);
  const meta = JSON.parse(raw) as ReviewMeta;
  return json({ name: meta.name, slug: meta.slug, stageConfig: meta.stageConfig });
}

async function ensureDefaultReview(env: Env, adminUsername: string) {
  const keys = reviewKeys(DEFAULT_REVIEW_SLUG);
  if (await env.KV.get(keys.meta)) return;

  const meta: ReviewMeta = {
    id: crypto.randomUUID(),
    name: 'Default Review',
    slug: DEFAULT_REVIEW_SLUG,
    createdAt: new Date().toISOString(),
    stageConfig: { stage1Mode: 'title_abstract', stage2Enabled: false },
  };
  await env.KV.put(keys.meta, JSON.stringify(meta));

  const legacyAdmin = await env.KV.get(GLOBAL_KEYS.legacyAdmin);
  if (legacyAdmin) {
    await env.KV.put(keys.admin, legacyAdmin);
  }

  const listRaw = await env.KV.get(GLOBAL_KEYS.reviewList);
  const slugs: string[] = listRaw ? JSON.parse(listRaw) : [];
  if (!slugs.includes(DEFAULT_REVIEW_SLUG)) {
    slugs.push(DEFAULT_REVIEW_SLUG);
    await env.KV.put(GLOBAL_KEYS.reviewList, JSON.stringify(slugs));
  }

  // Copy legacy data
  const legacyPapers = await env.KV.get(GLOBAL_KEYS.legacyPapers);
  if (legacyPapers) await env.KV.put(keys.papers, legacyPapers);
  const legacyRubric = await env.KV.get(GLOBAL_KEYS.legacyRubric);
  if (legacyRubric) await env.KV.put(keys.rubric, legacyRubric);

  const legacyReviewers = await env.KV.get(GLOBAL_KEYS.legacyReviewers);
  if (legacyReviewers) {
    await env.KV.put(keys.reviewers, legacyReviewers);
    const ids: string[] = JSON.parse(legacyReviewers);
    for (const id of ids) {
      const r = await env.KV.get(GLOBAL_KEYS.legacyReviewer(id));
      if (r) await env.KV.put(keys.reviewer(id), r);
      const d = await env.KV.get(GLOBAL_KEYS.legacyDecisions(id));
      if (d) await env.KV.put(keys.decisions(id), d);
    }
  }

  await appendAudit(env, DEFAULT_REVIEW_SLUG, 'auto_migrated', adminUsername);
}

export { isSuperAdmin, ensureDefaultReview };
