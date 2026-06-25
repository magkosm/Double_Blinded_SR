const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function toBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function asBuffer(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  usages: KeyUsage[],
  extractable = false,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    extractable,
    usages,
  );
}

export async function deriveProjectKey(
  password: string,
  salt?: Uint8Array,
  extractable = false,
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await deriveKey(password, s, ['encrypt', 'decrypt'], extractable);
  return { key, salt: s };
}

export async function deriveReviewerKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  return deriveKey(password, salt, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
}

export async function encryptJson<T>(data: T, password: string, salt?: Uint8Array) {
  const { key, salt: s } = await deriveProjectKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBuffer(iv) }, key, plaintext);
  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    salt: toBase64(s),
    version: 1,
  };
}

export async function decryptJson<T>(
  payload: { ciphertext: string; iv: string; salt: string },
  password: string,
): Promise<T> {
  const salt = fromBase64(payload.salt);
  const { key } = await deriveProjectKey(password, salt);
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ciphertext);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asBuffer(iv) }, key, asBuffer(ciphertext));
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

export async function wrapProjectKey(
  projectPassword: string,
  reviewerPassword: string,
  projectSalt?: Uint8Array,
) {
  // Key must be extractable to wrap as raw bytes (Web Crypto requirement)
  const { key: projectKey, salt: resolvedProjectSalt } = await deriveProjectKey(projectPassword, projectSalt, true);
  const reviewerSalt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const reviewerKey = await deriveReviewerKey(reviewerPassword, reviewerSalt);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const wrappedKey = await crypto.subtle.wrapKey('raw', projectKey, reviewerKey, { name: 'AES-GCM', iv: asBuffer(iv) });
  return {
    wrappedKey: toBase64(wrappedKey),
    iv: toBase64(iv),
    salt: toBase64(reviewerSalt),
    projectSalt: toBase64(resolvedProjectSalt),
  };
}

export async function unwrapProjectKey(
  wrapped: { wrappedKey: string; iv: string; salt: string; projectSalt?: string },
  reviewerPassword: string,
): Promise<{ key: CryptoKey; projectSalt: Uint8Array }> {
  const reviewerSalt = fromBase64(wrapped.salt);
  const reviewerKey = await deriveReviewerKey(reviewerPassword, reviewerSalt);
  const iv = fromBase64(wrapped.iv);
  const wrappedKey = fromBase64(wrapped.wrappedKey);
  const projectKeyRaw = await crypto.subtle.unwrapKey(
    'raw',
    asBuffer(wrappedKey),
    reviewerKey,
    { name: 'AES-GCM', iv: asBuffer(iv) },
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const projectSalt = wrapped.projectSalt
    ? fromBase64(wrapped.projectSalt)
    : crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return { key: projectKeyRaw, projectSalt };
}

export async function encryptWithKey<T>(data: T, key: CryptoKey, salt: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBuffer(iv) }, key, plaintext);
  return {
    ciphertext: toBase64(ciphertext),
    iv: toBase64(iv),
    salt: toBase64(salt),
    version: 1,
  };
}

export async function decryptWithKey<T>(
  payload: { ciphertext: string; iv: string; salt: string },
  key: CryptoKey,
): Promise<T> {
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ciphertext);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asBuffer(iv) }, key, asBuffer(ciphertext));
  return JSON.parse(new TextDecoder().decode(decrypted)) as T;
}

export function generatePassword(length = 16): string {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
