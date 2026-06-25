export interface Env {
  KV: KVNamespace;
  JWT_SECRET: string;
  BOOTSTRAP_TOKEN: string;
  ALLOWED_ORIGIN: string;
}

type Role = 'admin' | 'reviewer';

interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
  exp: number;
}

interface AdminRecord {
  username: string;
  passwordHash: string;
}

interface ReviewerRecord {
  id: string;
  username: string;
  passwordHash: string;
  wrappedProjectKey: {
    wrappedKey: string;
    iv: string;
    salt: string;
    projectSalt?: string;
  };
  createdAt: string;
}

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY_HOURS = 8;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;

const KEYS = {
  admin: 'auth:admin',
  reviewers: 'meta:reviewers',
  reviewer: (id: string) => `auth:reviewer:${id}`,
  papers: 'data:papers',
  rubric: 'data:rubric',
  decisions: (id: string) => `data:decisions:${id}`,
  rateLimit: (ip: string) => `ratelimit:${ip}`,
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') || '';
    const allowedOrigins = [env.ALLOWED_ORIGIN, 'http://localhost:5173', 'http://127.0.0.1:5173'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : env.ALLOWED_ORIGIN;

    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }), corsOrigin);
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;

      if (path === '/api/bootstrap' && request.method === 'POST') {
        return cors(await handleBootstrap(request, env), corsOrigin);
      }

      if (path === '/api/auth/login' && request.method === 'POST') {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        if (await isRateLimited(env, ip)) {
          return cors(json({ error: 'Too many requests' }, 429), corsOrigin);
        }
        return cors(await handleLogin(request, env), corsOrigin);
      }

      const auth = await verifyAuth(request, env);
      if (!auth && path.startsWith('/api/')) {
        return cors(json({ error: 'Unauthorized' }, 401), corsOrigin);
      }

      if (path === '/api/papers') {
        if (request.method === 'PUT' && auth?.role === 'admin') {
          return cors(await handlePutPapers(request, env), corsOrigin);
        }
        if (request.method === 'GET' && auth) {
          return cors(await handleGetPapers(env), corsOrigin);
        }
      }

      if (path === '/api/rubric') {
        if (request.method === 'PUT' && auth?.role === 'admin') {
          return cors(await handlePutRubric(request, env), corsOrigin);
        }
        if (request.method === 'GET' && auth) {
          return cors(await handleGetRubric(env), corsOrigin);
        }
      }

      const decisionsMatch = path.match(/^\/api\/decisions\/([^/]+)$/);
      if (decisionsMatch && auth) {
        const reviewerId = decisionsMatch[1];
        if (auth.role === 'reviewer' && auth.sub !== reviewerId) {
          return cors(json({ error: 'Forbidden' }, 403), corsOrigin);
        }
        if (request.method === 'PUT') {
          return cors(await handlePutDecisions(request, env, reviewerId), corsOrigin);
        }
        if (request.method === 'GET') {
          return cors(await handleGetDecisions(env, reviewerId), corsOrigin);
        }
      }

      if (path === '/api/reviewers' && auth?.role === 'admin') {
        if (request.method === 'GET') {
          return cors(await handleListReviewers(env), corsOrigin);
        }
        if (request.method === 'POST') {
          return cors(await handleCreateReviewer(request, env), corsOrigin);
        }
      }

      const reviewerMatch = path.match(/^\/api\/reviewers\/([^/]+)$/);
      if (reviewerMatch && auth) {
        const id = reviewerMatch[1];
        if (request.method === 'GET') {
          if (auth.role === 'admin' || auth.sub === id) {
            return cors(await handleGetReviewer(env, id), corsOrigin);
          }
          return cors(json({ error: 'Forbidden' }, 403), corsOrigin);
        }
        if (request.method === 'DELETE' && auth.role === 'admin') {
          return cors(await handleDeleteReviewer(env, id), corsOrigin);
        }
      }

      return cors(json({ error: 'Not found' }, 404), corsOrigin);
    } catch (e) {
      console.error(e);
      return cors(json({ error: 'Internal server error' }, 500), corsOrigin);
    }
  },
};

async function handleBootstrap(request: Request, env: Env): Promise<Response> {
  const existing = await env.KV.get(KEYS.admin);
  if (existing) return json({ error: 'Already bootstrapped' }, 409);

  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (token !== env.BOOTSTRAP_TOKEN) return json({ error: 'Invalid bootstrap token' }, 403);

  const body = (await request.json()) as { username: string; password: string };
  if (!body.username || !body.password) return json({ error: 'Missing credentials' }, 400);

  const bcrypt = await import('bcryptjs');
  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
  const admin: AdminRecord = { username: body.username, passwordHash };
  await env.KV.put(KEYS.admin, JSON.stringify(admin));
  return json({ ok: true, username: body.username });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { username: string; password: string; role: Role };
  const bcrypt = await import('bcryptjs');
  const { SignJWT } = await import('jose');

  if (body.role === 'admin') {
    const raw = await env.KV.get(KEYS.admin);
    if (!raw) return json({ error: 'Not bootstrapped' }, 503);
    const admin = JSON.parse(raw) as AdminRecord;
    if (admin.username !== body.username) return json({ error: 'Invalid credentials' }, 401);
    const valid = await bcrypt.compare(body.password, admin.passwordHash);
    if (!valid) return json({ error: 'Invalid credentials' }, 401);
    const token = await signJwt(env, { sub: 'admin', username: admin.username, role: 'admin' });
    return json({ token, role: 'admin', userId: 'admin', username: admin.username });
  }

  const idsRaw = await env.KV.get(KEYS.reviewers);
  const ids: string[] = idsRaw ? JSON.parse(idsRaw) : [];

  for (const id of ids) {
    const raw = await env.KV.get(KEYS.reviewer(id));
    if (!raw) continue;
    const reviewer = JSON.parse(raw) as ReviewerRecord;
    if (reviewer.username !== body.username) continue;
    const valid = await bcrypt.compare(body.password, reviewer.passwordHash);
    if (!valid) return json({ error: 'Invalid credentials' }, 401);
    const token = await signJwt(env, { sub: id, username: reviewer.username, role: 'reviewer' });
    return json({ token, role: 'reviewer', userId: id, username: reviewer.username });
  }

  return json({ error: 'Invalid credentials' }, 401);
}

async function handlePutPapers(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  await env.KV.put(KEYS.papers, JSON.stringify(body));
  return json({ ok: true });
}

async function handleGetPapers(env: Env): Promise<Response> {
  const raw = await env.KV.get(KEYS.papers);
  if (!raw) return json({ error: 'No papers uploaded' }, 404);
  return new Response(raw, { headers: { 'Content-Type': 'application/json' } });
}

async function handlePutRubric(request: Request, env: Env): Promise<Response> {
  const body = await request.json();
  await env.KV.put(KEYS.rubric, JSON.stringify(body));
  return json({ ok: true });
}

async function handleGetRubric(env: Env): Promise<Response> {
  const raw = await env.KV.get(KEYS.rubric);
  if (!raw) return json({ error: 'No rubric configured' }, 404);
  return new Response(raw, { headers: { 'Content-Type': 'application/json' } });
}

async function handlePutDecisions(request: Request, env: Env, reviewerId: string): Promise<Response> {
  const body = await request.json();
  await env.KV.put(KEYS.decisions(reviewerId), JSON.stringify(body));
  return json({ ok: true });
}

async function handleGetDecisions(env: Env, reviewerId: string): Promise<Response> {
  const raw = await env.KV.get(KEYS.decisions(reviewerId));
  if (!raw) return json({ error: 'No decisions' }, 404);
  return new Response(raw, { headers: { 'Content-Type': 'application/json' } });
}

async function handleListReviewers(env: Env): Promise<Response> {
  const idsRaw = await env.KV.get(KEYS.reviewers);
  const ids: string[] = idsRaw ? JSON.parse(idsRaw) : [];
  const reviewers = [];
  for (const id of ids) {
    const raw = await env.KV.get(KEYS.reviewer(id));
    if (!raw) continue;
    const r = JSON.parse(raw) as ReviewerRecord;
    reviewers.push({ id: r.id, username: r.username, createdAt: r.createdAt });
  }
  return json(reviewers);
}

async function handleGetReviewer(env: Env, id: string): Promise<Response> {
  const raw = await env.KV.get(KEYS.reviewer(id));
  if (!raw) return json({ error: 'Not found' }, 404);
  const r = JSON.parse(raw) as ReviewerRecord;
  return json({
    id: r.id,
    username: r.username,
    createdAt: r.createdAt,
    wrappedProjectKey: r.wrappedProjectKey,
  });
}

async function handleCreateReviewer(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    username: string;
    password: string;
    wrappedProjectKey: ReviewerRecord['wrappedProjectKey'];
  };
  const bcrypt = await import('bcryptjs');

  const idsRaw = await env.KV.get(KEYS.reviewers);
  const ids: string[] = idsRaw ? JSON.parse(idsRaw) : [];

  for (const id of ids) {
    const raw = await env.KV.get(KEYS.reviewer(id));
    if (!raw) continue;
    const r = JSON.parse(raw) as ReviewerRecord;
    if (r.username === body.username) return json({ error: 'Username taken' }, 409);
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
  const reviewer: ReviewerRecord = {
    id,
    username: body.username,
    passwordHash,
    wrappedProjectKey: body.wrappedProjectKey,
    createdAt: new Date().toISOString(),
  };
  await env.KV.put(KEYS.reviewer(id), JSON.stringify(reviewer));
  ids.push(id);
  await env.KV.put(KEYS.reviewers, JSON.stringify(ids));
  return json({ id, username: body.username, password: body.password });
}

async function handleDeleteReviewer(env: Env, id: string): Promise<Response> {
  const idsRaw = await env.KV.get(KEYS.reviewers);
  const ids: string[] = idsRaw ? JSON.parse(idsRaw) : [];
  await env.KV.delete(KEYS.reviewer(id));
  await env.KV.delete(KEYS.decisions(id));
  await env.KV.put(KEYS.reviewers, JSON.stringify(ids.filter((i) => i !== id)));
  return json({ ok: true });
}

async function signJwt(env: Env, payload: Omit<JwtPayload, 'exp'>): Promise<string> {
  const { SignJWT } = await import('jose');
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setExpirationTime(`${JWT_EXPIRY_HOURS}h`)
    .sign(secret);
}

async function verifyAuth(request: Request, env: Env): Promise<JwtPayload | null> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  try {
    const { jwtVerify } = await import('jose');
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: payload.sub as string,
      username: payload.username as string,
      role: payload.role as Role,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

async function isRateLimited(env: Env, ip: string): Promise<boolean> {
  const key = KEYS.rateLimit(ip);
  const raw = await env.KV.get(key);
  const now = Date.now();
  if (!raw) {
    await env.KV.put(key, JSON.stringify({ count: 1, windowStart: now }), { expirationTtl: 120 });
    return false;
  }
  const data = JSON.parse(raw) as { count: number; windowStart: number };
  if (now - data.windowStart > RATE_LIMIT_WINDOW_MS) {
    await env.KV.put(key, JSON.stringify({ count: 1, windowStart: now }), { expirationTtl: 120 });
    return false;
  }
  data.count++;
  await env.KV.put(key, JSON.stringify(data), { expirationTtl: 120 });
  return data.count > RATE_LIMIT_MAX;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function cors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, { status: response.status, headers });
}
