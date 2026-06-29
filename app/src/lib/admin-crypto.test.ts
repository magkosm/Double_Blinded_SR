import { describe, expect, it } from 'vitest';
import { formatReviewerProgress } from './admin-crypto';

describe('formatReviewerProgress', () => {
  it('shows fraction when corpus total known', () => {
    expect(
      formatReviewerProgress({ total: 10, pending: 3, include: 5, exclude: 2, maybe: 0, skip: 0 }),
    ).toBe('7/10');
  });

  it('shows decided count when corpus unknown', () => {
    expect(
      formatReviewerProgress({ total: 0, pending: 0, include: 4, exclude: 2, maybe: 1, skip: 0 }),
    ).toBe('7 decided');
  });
});
