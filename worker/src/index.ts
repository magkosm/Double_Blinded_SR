import type { Env, JwtPayload } from './types';
import { DEFAULT_REVIEW_SLUG } from './keys';
import { cors, json } from './util';
import { verifyAuth, isLoginBlocked, canAccessReview, isReviewAdmin, isSuperAdmin } from './auth';
import {
  handleBootstrap,
  handleLogin,
  handleUpgradeSuperAdmin,
  handleListReviews,
  handleCreateReview,
  handleDeleteReview,
  handleBootstrapReviewAdmin,
  handleGetReviewMeta,
  handleUpdateReviewMeta,
  handleGetReviewMetaPublic,
  handleGetReviewAdmin,
  handleResetReviewAdminPassword,
  handleListAllUsers,
} from './reviews';
import {
  handleListReviewers,
  handleGetReviewer,
  handleCreateReviewer,
  handleDeleteReviewer,
  handleGetDecisions,
  handlePutDecisions,
  handleGetFulltextNotes,
  handlePutFulltextNotes,
  handleResetReviewerPassword,
} from './reviewers';
import {
  handleGetPapers,
  handlePutPapers,
  handleGetRubric,
  handlePutRubric,
  handleListRisBatches,
  handlePutRisBatches,
  handleGetBuckets,
  handlePutBuckets,
  handleGetCustomFields,
  handlePutCustomFields,
  handleGetStats,
  handlePatchStats,
  handleUploadPdf,
  handleGetPdf,
  handlePutPdfMeta,
} from './papers';
import { handleGetProgress, handlePostConflicts, handleGetGlobalOverview } from './progress';

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
        let loginBody: { username?: string } = {};
        try {
          loginBody = await request.clone().json();
        } catch {
          /* empty body */
        }
        if (await isLoginBlocked(env, ip, loginBody.username || '')) {
          return cors(json({ error: 'Too many login attempts. Try again in a minute.' }, 429), corsOrigin);
        }
        return cors(await handleLogin(request, env), corsOrigin);
      }

      if (path === '/api/bootstrap/upgrade-super-admin' && request.method === 'POST') {
        return cors(await handleUpgradeSuperAdmin(request, env), corsOrigin);
      }

      const publicReviewMatch = path.match(/^\/api\/reviews\/([^/]+)\/public$/);
      if (publicReviewMatch && request.method === 'GET') {
        return cors(await handleGetReviewMetaPublic(env, publicReviewMatch[1]!), corsOrigin);
      }

      const auth = await verifyAuth(request, env);
      if (!auth && path.startsWith('/api/')) {
        return cors(json({ error: 'Unauthorized' }, 401), corsOrigin);
      }

      const legacy = auth ? await handleLegacyRoutes(request, env, auth, path) : null;
      if (legacy) return cors(legacy, corsOrigin);

      if (path === '/api/reviews' && auth) {
        if (request.method === 'GET' && isSuperAdmin(auth)) {
          return cors(await handleListReviews(env), corsOrigin);
        }
        if (request.method === 'POST' && isSuperAdmin(auth)) {
          return cors(await handleCreateReview(request, env), corsOrigin);
        }
      }

      if (path === '/api/overview' && auth && isSuperAdmin(auth) && request.method === 'GET') {
        return cors(await handleGetGlobalOverview(env), corsOrigin);
      }

      if (path === '/api/users' && auth && isSuperAdmin(auth) && request.method === 'GET') {
        return cors(await handleListAllUsers(env), corsOrigin);
      }

      const reviewMatch = path.match(/^\/api\/reviews\/([^/]+)(\/.*)?$/);
      if (reviewMatch && auth) {
        const slug = reviewMatch[1]!;
        const sub = reviewMatch[2] || '';
        if (!canAccessReview(auth, slug)) {
          return cors(json({ error: 'Forbidden' }, 403), corsOrigin);
        }
        const res = await routeReviewSubpath(request, env, auth, slug, sub);
        if (res) return cors(res, corsOrigin);
      }

      if (path === '/api/conflicts' && auth && request.method === 'POST') {
        if (!isSuperAdmin(auth) && auth.role !== 'review_admin') {
          return cors(json({ error: 'Forbidden' }, 403), corsOrigin);
        }
        return cors(await handlePostConflicts(request), corsOrigin);
      }

      return cors(json({ error: 'Not found' }, 404), corsOrigin);
    } catch (e) {
      console.error(e);
      return cors(json({ error: 'Internal server error' }, 500), corsOrigin);
    }
  },
};

async function handleLegacyRoutes(
  request: Request,
  env: Env,
  auth: JwtPayload,
  path: string,
): Promise<Response | null> {
  const slug = auth.reviewSlug || DEFAULT_REVIEW_SLUG;
  const isAdmin = auth.role === 'review_admin' || auth.role === 'super_admin';

  if (path === '/api/papers') {
    if (request.method === 'PUT' && isAdmin) return handlePutPapers(request, env, slug);
    if (request.method === 'GET') return handleGetPapers(env, slug);
  }

  if (path === '/api/rubric') {
    if (request.method === 'PUT' && isAdmin) return handlePutRubric(request, env, slug);
    if (request.method === 'GET') return handleGetRubric(env, slug);
  }

  const decisionsMatch = path.match(/^\/api\/decisions\/([^/]+)$/);
  if (decisionsMatch) {
    const reviewerId = decisionsMatch[1]!;
    if (auth.role === 'reviewer' && auth.sub !== reviewerId) {
      return json({ error: 'Forbidden' }, 403);
    }
    if (request.method === 'PUT') return handlePutDecisions(request, env, slug, reviewerId);
    if (request.method === 'GET') return handleGetDecisions(env, slug, reviewerId);
  }

  if (path === '/api/reviewers' && isAdmin) {
    if (request.method === 'GET') return handleListReviewers(env, slug);
    if (request.method === 'POST') return handleCreateReviewer(request, env, slug);
  }

  const reviewerMatch = path.match(/^\/api\/reviewers\/([^/]+)$/);
  if (reviewerMatch) {
    const id = reviewerMatch[1]!;
    if (request.method === 'GET' && (isAdmin || auth.sub === id)) {
      return handleGetReviewer(env, slug, id);
    }
    if (request.method === 'DELETE' && isAdmin) return handleDeleteReviewer(env, slug, id);
  }

  return null;
}

async function routeReviewSubpath(
  request: Request,
  env: Env,
  auth: JwtPayload,
  slug: string,
  sub: string,
): Promise<Response | null> {
  if (sub === '' && request.method === 'GET') return handleGetReviewMeta(env, slug);
  if (sub === '' && request.method === 'PATCH' && isReviewAdmin(auth, slug)) {
    return handleUpdateReviewMeta(request, env, slug);
  }
  if (sub === '/bootstrap-admin' && request.method === 'POST' && isSuperAdmin(auth)) {
    return handleBootstrapReviewAdmin(request, env, slug);
  }
  if (sub === '/admin' && request.method === 'GET' && isSuperAdmin(auth)) {
    return handleGetReviewAdmin(env, slug);
  }
  if (sub === '/admin/reset-password' && request.method === 'POST' && isSuperAdmin(auth)) {
    return handleResetReviewAdminPassword(request, env, slug);
  }
  if (sub === '' && request.method === 'DELETE' && isSuperAdmin(auth)) {
    return handleDeleteReview(env, slug);
  }

  if (sub === '/papers') {
    if (request.method === 'GET') return handleGetPapers(env, slug);
    if (request.method === 'PUT' && isReviewAdmin(auth, slug)) return handlePutPapers(request, env, slug);
  }

  if (sub === '/rubric') {
    if (request.method === 'GET') return handleGetRubric(env, slug);
    if (request.method === 'PUT' && isReviewAdmin(auth, slug)) return handlePutRubric(request, env, slug);
  }

  if (sub === '/ris-batches') {
    if (request.method === 'GET') return handleListRisBatches(env, slug);
    if (request.method === 'PUT' && isReviewAdmin(auth, slug)) return handlePutRisBatches(request, env, slug);
  }

  if (sub === '/buckets') {
    if (request.method === 'GET') return handleGetBuckets(env, slug);
    if (request.method === 'PUT' && isReviewAdmin(auth, slug)) return handlePutBuckets(request, env, slug);
  }

  if (sub === '/custom-fields') {
    if (request.method === 'GET') return handleGetCustomFields(env, slug);
    if (request.method === 'PUT' && isReviewAdmin(auth, slug)) return handlePutCustomFields(request, env, slug);
  }

  if (sub === '/stats') {
    if (request.method === 'GET') return handleGetStats(env, slug);
    if (request.method === 'PATCH') return handlePatchStats(request, env, slug);
  }

  if (sub === '/progress' && request.method === 'GET' && (isReviewAdmin(auth, slug) || isSuperAdmin(auth))) {
    return handleGetProgress(env, slug);
  }

  if (sub === '/reviewers' && isReviewAdmin(auth, slug)) {
    if (request.method === 'GET') return handleListReviewers(env, slug);
    if (request.method === 'POST') return handleCreateReviewer(request, env, slug);
  }

  const reviewerMatch = sub.match(/^\/reviewers\/([^/]+)(\/.*)?$/);
  if (reviewerMatch) {
    const id = reviewerMatch[1]!;
    const reviewerSub = reviewerMatch[2] || '';
    if (reviewerSub === '/reset-password' && request.method === 'POST' && isReviewAdmin(auth, slug)) {
      return handleResetReviewerPassword(request, env, slug, id);
    }
    if (reviewerSub === '' && request.method === 'GET' && (isReviewAdmin(auth, slug) || auth.sub === id)) {
      return handleGetReviewer(env, slug, id);
    }
    if (reviewerSub === '' && request.method === 'DELETE' && isReviewAdmin(auth, slug)) {
      return handleDeleteReviewer(env, slug, id);
    }
  }

  const decisionsMatch = sub.match(/^\/decisions\/([^/]+)$/);
  if (decisionsMatch) {
    const reviewerId = decisionsMatch[1]!;
    if (auth.role === 'reviewer' && auth.sub !== reviewerId) {
      return json({ error: 'Forbidden' }, 403);
    }
    if (request.method === 'PUT') return handlePutDecisions(request, env, slug, reviewerId);
    if (request.method === 'GET') return handleGetDecisions(env, slug, reviewerId);
  }

  const fulltextMatch = sub.match(/^\/fulltext\/([^/]+)\/([^/]+)$/);
  if (fulltextMatch) {
    const reviewerId = fulltextMatch[1]!;
    const paperId = fulltextMatch[2]!;
    if (auth.role === 'reviewer' && auth.sub !== reviewerId) {
      return json({ error: 'Forbidden' }, 403);
    }
    if (request.method === 'GET') return handleGetFulltextNotes(env, slug, reviewerId, paperId);
    if (request.method === 'PUT') return handlePutFulltextNotes(request, env, slug, reviewerId, paperId);
  }

  const pdfMatch = sub.match(/^\/pdf\/([^/]+)$/);
  if (pdfMatch) {
    const paperId = pdfMatch[1]!;
    if (request.method === 'GET') return handleGetPdf(env, slug, paperId);
    if (request.method === 'PUT' && isReviewAdmin(auth, slug)) return handlePutPdfMeta(request, env, slug, paperId);
    if (request.method === 'POST' && isReviewAdmin(auth, slug)) return handleUploadPdf(request, env, slug, paperId);
  }

  return null;
}

export type { Env };
