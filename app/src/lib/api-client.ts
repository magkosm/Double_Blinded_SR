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

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(body || res.statusText, res.status);
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
