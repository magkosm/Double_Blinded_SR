export type Role = 'super_admin' | 'review_admin' | 'reviewer';

export interface Env {
  KV: KVNamespace;
  PDF_BUCKET?: R2Bucket;
  JWT_SECRET: string;
  BOOTSTRAP_TOKEN: string;
  ALLOWED_ORIGIN: string;
}

export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
  reviewSlug?: string;
  exp: number;
}

export interface SuperAdminRecord {
  username: string;
  passwordHash: string;
}

export interface AdminRecord {
  username: string;
  passwordHash: string;
}

export interface ReviewerRecord {
  id: string;
  username: string;
  passwordHash: string;
  wrappedProjectKey: {
    wrappedKey: string;
    iv: string;
    salt: string;
    projectSalt?: string;
  };
  createdAt: string;
}

export interface ReviewMeta {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  stageConfig: {
    stage1Mode: 'title_only' | 'title_abstract';
    stage2Enabled: boolean;
  };
}

export interface RisBatch {
  id: string;
  label: string;
  filename: string;
  uploadedAt: string;
  recordCount: number;
}

export interface UsageStats {
  logins: number;
  decisions: { include: number; exclude: number; maybe: number; skip: number };
  undos: number;
  papersScreened: number;
  updatedAt: string;
}

export interface BucketConfig {
  labels: string[];
}

export interface CustomFieldSchema {
  columns: { id: string; label: string; type: 'text' | 'number' }[];
}
