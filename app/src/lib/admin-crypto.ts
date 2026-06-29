import type { DecisionRecord, EncryptedPayload, WrappedKey } from '../types';
import { decryptJson, decryptWithKey, deriveProjectKey } from './crypto';

export async function decryptDecisionPayload(
  payload: EncryptedPayload,
  projectPassword: string,
  keys: CryptoKey[],
): Promise<DecisionRecord[]> {
  for (const key of keys) {
    try {
      return await decryptWithKey<DecisionRecord[]>(payload, key);
    } catch {
      /* try next derived key */
    }
  }
  return decryptJson<DecisionRecord[]>(payload, projectPassword);
}

export async function projectKeyFromWrapped(
  projectPassword: string,
  wrapped?: WrappedKey | null,
): Promise<CryptoKey | null> {
  if (!wrapped?.projectSalt) return null;
  const salt = Uint8Array.from(atob(wrapped.projectSalt), (c) => c.charCodeAt(0));
  const { key } = await deriveProjectKey(projectPassword, salt);
  return key;
}

export async function projectKeyFromPapersPayload(
  projectPassword: string,
  papersPayload?: EncryptedPayload | null,
): Promise<CryptoKey | null> {
  if (!papersPayload?.salt) return null;
  const salt = Uint8Array.from(atob(papersPayload.salt), (c) => c.charCodeAt(0));
  const { key } = await deriveProjectKey(projectPassword, salt);
  return key;
}

/** Collect unique project keys (papers upload salt + reviewer wrap salt). */
export async function adminDecryptKeys(
  projectPassword: string,
  papersPayload: EncryptedPayload | null | undefined,
  reviewerWrapped?: WrappedKey | null,
): Promise<CryptoKey[]> {
  const keys: CryptoKey[] = [];
  const seen = new Set<string>();

  async function addKey(key: CryptoKey | null, saltB64?: string) {
    if (!key) return;
    const tag = saltB64 || 'default';
    if (seen.has(tag)) return;
    seen.add(tag);
    keys.push(key);
  }

  if (papersPayload?.salt) {
    await addKey(await projectKeyFromPapersPayload(projectPassword, papersPayload), papersPayload.salt);
  }
  if (reviewerWrapped?.projectSalt) {
    await addKey(await projectKeyFromWrapped(projectPassword, reviewerWrapped), reviewerWrapped.projectSalt);
  }

  return keys;
}

export function formatReviewerProgress(stats: {
  total: number;
  pending: number;
  include: number;
  exclude: number;
  maybe: number;
  skip: number;
}): string {
  const decided = stats.include + stats.exclude + stats.maybe + stats.skip;
  if (stats.total > 0) return `${stats.total - stats.pending}/${stats.total}`;
  if (decided > 0) return `${decided} decided`;
  return '—';
}
