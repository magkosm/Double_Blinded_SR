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
};

export type Decision = 'include' | 'exclude' | 'maybe' | 'skip';

export type DecisionRecord = {
  paperId: string;
  decision: Decision;
  decidedAt: string;
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
};

export type ReviewerMeta = {
  id: string;
  username: string;
  createdAt: string;
  wrappedProjectKey: WrappedKey;
};

export type AuthSession = {
  token: string;
  role: 'admin' | 'reviewer';
  userId: string;
  username: string;
};

export type ProgressStats = {
  include: number;
  exclude: number;
  maybe: number;
  skip: number;
  pending: number;
  total: number;
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
