import type { Env, JwtPayload, Role } from './types';
import { GLOBAL_KEYS } from './keys';

export const BCRYPT_ROUNDS = 12;
export const JWT_EXPIRY_HOURS = 8;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_IP = 30;
export const RATE_LIMIT_MAX_USER = 10;

async function incrementRateLimit(env: Env, key: string, max: number): Promise<boolean> {
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
  return data.count > max;
}

export async function isRateLimited(env: Env, ip: string): Promise<boolean> {
  return incrementRateLimit(env, GLOBAL_KEYS.rateLimit(`ip:${ip}`), RATE_LIMIT_MAX_IP);
}

export async function signJwt(env: Env, payload: Omit<JwtPayload, 'exp'>): Promise<string> {
  const { SignJWT } = await import('jose');
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const claims: Record<string, string> = {
    username: payload.username,
    role: payload.role,
  };
  if (payload.reviewSlug) claims.reviewSlug = payload.reviewSlug;
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setExpirationTime(`${JWT_EXPIRY_HOURS}h`)
    .sign(secret);
}

export async function verifyAuth(request: Request, env: Env): Promise<JwtPayload | null> {
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
      reviewSlug: payload.reviewSlug as string | undefined,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

export async function isLoginBlocked(env: Env, ip: string, username: string): Promise<boolean> {
  const byIp = await incrementRateLimit(env, GLOBAL_KEYS.rateLimit(`ip:${ip}`), RATE_LIMIT_MAX_IP);
  if (byIp) return true;
  const normalized = username.trim().toLowerCase() || 'unknown';
  return incrementRateLimit(env, GLOBAL_KEYS.rateLimit(`user:${normalized}`), RATE_LIMIT_MAX_USER);
}

export function canAccessReview(auth: JwtPayload, slug: string): boolean {
  if (auth.role === 'super_admin') return true;
  return auth.reviewSlug === slug;
}

export function isReviewAdmin(auth: JwtPayload, slug: string): boolean {
  return auth.role === 'super_admin' || (auth.role === 'review_admin' && auth.reviewSlug === slug);
}

export function isSuperAdmin(auth: JwtPayload): boolean {
  return auth.role === 'super_admin';
}

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(password, hash);
}

export async function appendAudit(env: Env, slug: string, event: string, detail?: string) {
  const key = `review:${slug}:audit`;
  const raw = await env.KV.get(key);
  const log: { at: string; event: string; detail?: string }[] = raw ? JSON.parse(raw) : [];
  log.push({ at: new Date().toISOString(), event, detail });
  if (log.length > 200) log.splice(0, log.length - 200);
  await env.KV.put(key, JSON.stringify(log));
}
