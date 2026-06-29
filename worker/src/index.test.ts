import { describe, expect, it } from 'vitest';
import { slugValid } from '../src/util';

describe('util', () => {
  it('validates slugs', () => {
    expect(slugValid('default')).toBe(true);
    expect(slugValid('my-review-2')).toBe(true);
    expect(slugValid('Bad_Slug')).toBe(false);
    expect(slugValid('')).toBe(false);
  });
});

describe('auth scopes', () => {
  it('super_admin can access any review', async () => {
    const { canAccessReview } = await import('../src/auth');
    expect(
      canAccessReview({ sub: 'x', username: 'a', role: 'super_admin', exp: 0 }, 'any-slug'),
    ).toBe(true);
  });

  it('reviewer scoped to review', async () => {
    const { canAccessReview } = await import('../src/auth');
    expect(
      canAccessReview(
        { sub: 'r1', username: 'u', role: 'reviewer', reviewSlug: 'a', exp: 0 },
        'a',
      ),
    ).toBe(true);
    expect(
      canAccessReview(
        { sub: 'r1', username: 'u', role: 'reviewer', reviewSlug: 'a', exp: 0 },
        'b',
      ),
    ).toBe(false);
  });
});
