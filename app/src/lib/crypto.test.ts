import { describe, expect, it } from 'vitest';
import {
  decryptJson,
  decryptWithKey,
  deriveProjectKey,
  encryptJson,
  encryptWithKey,
  unwrapProjectKey,
  wrapProjectKey,
} from './crypto';

describe('crypto round-trip', () => {
  it('encryptJson / decryptJson', async () => {
    const data = { papers: [{ id: '1', title: 'Test' }] };
    const payload = await encryptJson(data, 'project-secret');
    const out = await decryptJson<typeof data>(payload, 'project-secret');
    expect(out).toEqual(data);
  });

  it('encryptWithKey / decryptWithKey', async () => {
    const { key, salt } = await deriveProjectKey('pw', undefined, false);
    const data = [{ paperId: '1', decision: 'include' as const, decidedAt: '2026-01-01' }];
    const payload = await encryptWithKey(data, key, salt);
    const out = await decryptWithKey<typeof data>(payload, key);
    expect(out).toEqual(data);
  });

  it('wrapProjectKey / unwrapProjectKey', async () => {
    const wrapped = await wrapProjectKey('project-pw', 'reviewer-pw');
    const { key, projectSalt } = await unwrapProjectKey(wrapped, 'reviewer-pw');
    const data = { test: true };
    const payload = await encryptWithKey(data, key, projectSalt);
    const out = await decryptWithKey(payload, key);
    expect(out).toEqual(data);
  });
});
