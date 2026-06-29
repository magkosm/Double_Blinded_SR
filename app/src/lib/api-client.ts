import type {
  AuthSession,
  BucketConfig,
  CustomFieldSchema,
  DecisionRecord,
  EncryptedPayload,
  FulltextNotes,
  ImportReport,
  ReviewMeta,
  ReviewerMeta,
  RisBatch,
  UsageStats,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function parseErrorBody(body: string): string {
  try {
    const json = JSON.parse(body) as { error?: string };
    if (json.error) return json.error;
  } catch {
    /* plain text */
  }
  return body;
}

function reviewPath(slug: string, sub: string) {
  return `/api/reviews/${slug}${sub}`;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  if (!API_URL) {
    throw new ApiError('App is not configured with an API URL. Redeploy with VITE_API_URL set.', 0);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      'Cannot reach the screening API. This is often caused by a blocked network request — try refreshing or contact the admin.',
      0,
    );
  }

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(parseErrorBody(body) || res.statusText, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function login(
  username: string,
  password: string,
  role: AuthSession['role'],
  reviewSlug?: string,
): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, role, reviewSlug }),
  });
}

// Legacy + scoped papers
export async function uploadPapers(payload: EncryptedPayload, token: string, reviewSlug = 'default') {
  return request(reviewPath(reviewSlug, '/papers'), { method: 'PUT', body: JSON.stringify(payload) }, token);
}

export async function fetchPapers(token: string, reviewSlug = 'default'): Promise<EncryptedPayload> {
  return request(reviewPath(reviewSlug, '/papers'), {}, token);
}

export async function uploadRubric(payload: EncryptedPayload, token: string, reviewSlug = 'default') {
  return request(reviewPath(reviewSlug, '/rubric'), { method: 'PUT', body: JSON.stringify(payload) }, token);
}

export async function fetchRubric(token: string, reviewSlug = 'default'): Promise<EncryptedPayload | null> {
  try {
    return await request<EncryptedPayload>(reviewPath(reviewSlug, '/rubric'), {}, token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function saveDecisions(
  reviewerId: string,
  payload: EncryptedPayload,
  token: string,
  reviewSlug = 'default',
) {
  return request(reviewPath(reviewSlug, `/decisions/${reviewerId}`), {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);
}

export async function fetchDecisions(
  reviewerId: string,
  token: string,
  reviewSlug = 'default',
): Promise<EncryptedPayload | null> {
  try {
    return await request<EncryptedPayload>(reviewPath(reviewSlug, `/decisions/${reviewerId}`), {}, token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function listReviewers(token: string, reviewSlug = 'default') {
  return request<Omit<ReviewerMeta, 'wrappedProjectKey'>[]>(reviewPath(reviewSlug, '/reviewers'), {}, token);
}

export async function createReviewer(
  body: {
    username: string;
    password: string;
    wrappedProjectKey: ReviewerMeta['wrappedProjectKey'] & { projectSalt?: string };
  },
  token: string,
  reviewSlug = 'default',
) {
  return request<{ id: string; username: string; password: string }>(
    reviewPath(reviewSlug, '/reviewers'),
    { method: 'POST', body: JSON.stringify(body) },
    token,
  );
}

export async function deleteReviewer(id: string, token: string, reviewSlug = 'default') {
  return request(reviewPath(reviewSlug, `/reviewers/${id}`), { method: 'DELETE' }, token);
}

export async function resetReviewerPassword(id: string, token: string, reviewSlug: string, password?: string) {
  return request<{ ok: boolean; username: string; password: string }>(
    reviewPath(reviewSlug, `/reviewers/${id}/reset-password`),
    { method: 'POST', body: JSON.stringify(password ? { password } : {}) },
    token,
  );
}

export async function resetReviewAdminPassword(slug: string, token: string, password?: string) {
  return request<{ ok: boolean; username: string; password: string }>(
    `/api/reviews/${slug}/admin/reset-password`,
    { method: 'POST', body: JSON.stringify(password ? { password } : {}) },
    token,
  );
}

export async function listAllUsers(token: string) {
  return request<{
    superAdmin: string | null;
    reviews: {
      slug: string;
      name: string;
      adminUsername: string | null;
      reviewers: { id: string; username: string; createdAt: string }[];
    }[];
  }>('/api/users', {}, token);
}

export async function fetchReviewerMeta(id: string, token: string, reviewSlug = 'default'): Promise<ReviewerMeta> {
  return request(reviewPath(reviewSlug, `/reviewers/${id}`), {}, token);
}

export async function listReviews(token: string): Promise<ReviewMeta[]> {
  return request('/api/reviews', {}, token);
}

export async function createReview(body: { name: string; slug: string }, token: string): Promise<ReviewMeta> {
  return request('/api/reviews', { method: 'POST', body: JSON.stringify(body) }, token);
}

export async function deleteReview(slug: string, token: string) {
  return request(`/api/reviews/${slug}`, { method: 'DELETE' }, token);
}

export async function bootstrapReviewAdmin(
  slug: string,
  body: { username: string; password: string },
  token: string,
) {
  return request(`/api/reviews/${slug}/bootstrap-admin`, { method: 'POST', body: JSON.stringify(body) }, token);
}

export async function fetchReviewMeta(token: string, slug: string): Promise<ReviewMeta> {
  return request(`/api/reviews/${slug}`, {}, token);
}

export async function fetchReviewPublic(slug: string): Promise<Pick<ReviewMeta, 'name' | 'slug' | 'stageConfig'>> {
  return request(`/api/reviews/${slug}/public`, {});
}

export async function updateReviewMeta(token: string, slug: string, patch: Partial<ReviewMeta>) {
  return request(`/api/reviews/${slug}`, { method: 'PATCH', body: JSON.stringify(patch) }, token);
}

export async function listRisBatches(token: string, reviewSlug: string): Promise<RisBatch[]> {
  return request(reviewPath(reviewSlug, '/ris-batches'), {}, token);
}

export async function saveRisBatches(token: string, reviewSlug: string, batches: RisBatch[]) {
  return request(reviewPath(reviewSlug, '/ris-batches'), { method: 'PUT', body: JSON.stringify(batches) }, token);
}

export async function fetchBuckets(token: string, reviewSlug: string): Promise<BucketConfig> {
  return request(reviewPath(reviewSlug, '/buckets'), {}, token);
}

export async function saveBuckets(token: string, reviewSlug: string, config: BucketConfig) {
  return request(reviewPath(reviewSlug, '/buckets'), { method: 'PUT', body: JSON.stringify(config) }, token);
}

export async function fetchCustomFields(token: string, reviewSlug: string): Promise<CustomFieldSchema> {
  return request(reviewPath(reviewSlug, '/custom-fields'), {}, token);
}

export async function saveCustomFields(token: string, reviewSlug: string, schema: CustomFieldSchema) {
  return request(reviewPath(reviewSlug, '/custom-fields'), { method: 'PUT', body: JSON.stringify(schema) }, token);
}

export async function fetchProgress(token: string, reviewSlug: string) {
  return request(reviewPath(reviewSlug, '/progress'), {}, token);
}

export async function postConflicts(
  token: string,
  body: { reviewers: { id: string; decisions: Record<string, string> }[] },
) {
  return request<{ conflicts: { paperId: string; decisions: Record<string, string> }[]; count: number }>(
    '/api/conflicts',
    { method: 'POST', body: JSON.stringify(body) },
    token,
  );
}

export async function fetchGlobalOverview(token: string) {
  return request('/api/overview', {}, token);
}

export async function patchStats(
  token: string,
  reviewSlug: string,
  patch: Partial<UsageStats> & { decisionType?: keyof UsageStats['decisions'] },
) {
  return request(reviewPath(reviewSlug, '/stats'), { method: 'PATCH', body: JSON.stringify(patch) }, token);
}

export async function fetchFulltextNotes(
  token: string,
  reviewSlug: string,
  reviewerId: string,
  paperId: string,
): Promise<FulltextNotes | null> {
  try {
    const payload = await request<EncryptedPayload>(
      reviewPath(reviewSlug, `/fulltext/${reviewerId}/${paperId}`),
      {},
      token,
    );
    return payload as unknown as FulltextNotes;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function saveFulltextNotes(
  token: string,
  reviewSlug: string,
  reviewerId: string,
  paperId: string,
  payload: EncryptedPayload,
) {
  return request(reviewPath(reviewSlug, `/fulltext/${reviewerId}/${paperId}`), {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);
}

export async function uploadPdf(
  token: string,
  reviewSlug: string,
  paperId: string,
  file: Blob,
  filename: string,
) {
  if (!API_URL) throw new ApiError('No API URL', 0);
  const res = await fetch(
    `${API_URL}${reviewPath(reviewSlug, `/pdf/${paperId}`)}?filename=${encodeURIComponent(filename)}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' },
      body: file,
    },
  );
  if (!res.ok) throw new ApiError(await res.text(), res.status);
  return res.json();
}

export function pdfUrl(reviewSlug: string, paperId: string): string {
  return `${API_URL}${reviewPath(reviewSlug, `/pdf/${paperId}`)}`;
}

export type { DecisionRecord, ImportReport };
