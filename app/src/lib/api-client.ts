import type { AuthSession, DecisionRecord, EncryptedPayload, ReviewerMeta } from '../types';

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

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
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

export async function login(username: string, password: string, role: 'admin' | 'reviewer'): Promise<AuthSession> {
  return request<AuthSession>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, role }),
  });
}

export async function uploadPapers(payload: EncryptedPayload, token: string) {
  return request('/api/papers', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);
}

export async function fetchPapers(token: string): Promise<EncryptedPayload> {
  return request('/api/papers', {}, token);
}

export async function uploadRubric(payload: EncryptedPayload, token: string) {
  return request('/api/rubric', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);
}

export async function fetchRubric(token: string): Promise<EncryptedPayload | null> {
  try {
    return await request<EncryptedPayload>('/api/rubric', {}, token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function saveDecisions(
  reviewerId: string,
  payload: EncryptedPayload,
  token: string,
) {
  return request(`/api/decisions/${reviewerId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);
}

export async function fetchDecisions(
  reviewerId: string,
  token: string,
): Promise<EncryptedPayload | null> {
  try {
    return await request<EncryptedPayload>(`/api/decisions/${reviewerId}`, {}, token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function listReviewers(token: string): Promise<Omit<ReviewerMeta, 'wrappedProjectKey'>[]> {
  return request('/api/reviewers', {}, token);
}

export async function createReviewer(
  body: { username: string; password: string; wrappedProjectKey: ReviewerMeta['wrappedProjectKey'] & { projectSalt?: string } },
  token: string,
): Promise<{ id: string; username: string; password: string }> {
  return request('/api/reviewers', {
    method: 'POST',
    body: JSON.stringify(body),
  }, token);
}

export async function deleteReviewer(id: string, token: string) {
  return request(`/api/reviewers/${id}`, { method: 'DELETE' }, token);
}

export async function fetchReviewerMeta(id: string, token: string): Promise<ReviewerMeta> {
  return request(`/api/reviewers/${id}`, {}, token);
}

export type { DecisionRecord };
