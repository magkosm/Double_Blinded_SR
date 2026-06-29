export type ScreeningRubric = {
  reviewQuestion: string;
  inclusionCriteria: string;
  exclusionCriteria: string;
  generalNotes: string;
  updatedAt?: string;
};

export const EMPTY_RUBRIC: ScreeningRubric = {
  reviewQuestion: '',
  inclusionCriteria: '',
  exclusionCriteria: '',
  generalNotes: '',
};

export type ScreeningRecord = {
  id: string;
  title: string;
  journal: string;
  abstract: string;
  year?: number;
  doi?: string;
  sourceBatchId?: string;
  externalIds?: { doi?: string; pmid?: string };
  dedupeKey?: string;
  pdfFilename?: string;
  l1Path?: string;
};

export type Decision = 'include' | 'exclude' | 'maybe' | 'skip';

export type DecisionRecord = {
  paperId: string;
  decision: Decision;
  decidedAt: string;
  buckets?: string[];
  notes?: string;
  timeSpentMs?: number;
};

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
  salt: string;
  version: number;
};

export type WrappedKey = {
  wrappedKey: string;
  iv: string;
  salt: string;
  projectSalt?: string;
};

export type ReviewerMeta = {
  id: string;
  username: string;
  createdAt: string;
  wrappedProjectKey: WrappedKey;
};

export type UserRole = 'super_admin' | 'review_admin' | 'reviewer';

export type AuthSession = {
  token: string;
  role: UserRole;
  userId: string;
  username: string;
  reviewSlug?: string;
};

export type ReviewMeta = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  stageConfig: {
    stage1Mode: 'title_only' | 'title_abstract';
    stage2Enabled: boolean;
  };
};

export type RisBatch = {
  id: string;
  label: string;
  filename: string;
  uploadedAt: string;
  recordCount: number;
};

export type ImportReport = {
  batchId: string;
  added: number;
  duplicates: number;
  failed: number;
  totalInFile: number;
};

export type ProgressStats = {
  include: number;
  exclude: number;
  maybe: number;
  skip: number;
  pending: number;
  total: number;
};

export type BucketConfig = {
  labels: string[];
};

export type CustomFieldSchema = {
  columns: { id: string; label: string; type: 'text' | 'number' }[];
};

export type FulltextNotes = {
  comments: { id: string; text: string; page: number; createdAt: string }[];
  annotations: { id: string; label: string; page: number; rects: number[]; createdAt: string }[];
  customFields: Record<string, string | number>;
  generalNotes: string;
};

export type UsageStats = {
  logins: number;
  decisions: { include: number; exclude: number; maybe: number; skip: number };
  undos: number;
  papersScreened: number;
  updatedAt: string;
};

export const DECISION_LABELS: Record<Decision, string> = {
  include: 'Include',
  exclude: 'Exclude',
  maybe: 'Maybe',
  skip: 'Skipped',
};

export const DECISION_COLORS: Record<Decision, string> = {
  include: 'bg-emerald-500',
  exclude: 'bg-rose-500',
  maybe: 'bg-amber-500',
  skip: 'bg-slate-400',
};

export const DEFAULT_BUCKETS = ['Off topic', 'Wrong subject population'];
