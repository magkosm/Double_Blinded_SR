export const GLOBAL_KEYS = {
  superAdmin: 'auth:super_admin',
  reviewList: 'meta:reviews',
  legacyAdmin: 'auth:admin',
  legacyReviewers: 'meta:reviewers',
  legacyPapers: 'data:papers',
  legacyRubric: 'data:rubric',
  legacyReviewer: (id: string) => `auth:reviewer:${id}`,
  legacyDecisions: (id: string) => `data:decisions:${id}`,
  rateLimit: (ip: string) => `ratelimit:${ip}`,
};

export const DEFAULT_REVIEW_SLUG = 'default';

export function reviewKeys(slug: string) {
  return {
    meta: `review:${slug}:meta`,
    admin: `review:${slug}:auth:admin`,
    reviewers: `review:${slug}:meta:reviewers`,
    reviewer: (id: string) => `review:${slug}:auth:reviewer:${id}`,
    papers: `review:${slug}:data:papers`,
    rubric: `review:${slug}:data:rubric`,
    decisions: (id: string) => `review:${slug}:data:decisions:${id}`,
    risBatches: `review:${slug}:meta:ris_batches`,
    events: `review:${slug}:events`,
    buckets: `review:${slug}:meta:buckets`,
    customFields: `review:${slug}:meta:custom_fields`,
    stats: `review:${slug}:data:stats`,
    fulltextNotes: (reviewerId: string, paperId: string) =>
      `review:${slug}:data:fulltext:${reviewerId}:${paperId}`,
    pdfMeta: (paperId: string) => `review:${slug}:meta:pdf:${paperId}`,
  };
}

export function pdfR2Key(slug: string, paperId: string, filename: string) {
  return `${slug}/${paperId}/${filename}`;
}
