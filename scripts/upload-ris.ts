import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SECRETS_PATH = resolve(ROOT, '.secrets.local');

const RIS_DEFAULT = resolve(
  ROOT,
  'scopus_export_Jun 18-2026_642141a5-a34e-4acb-aa31-eb18be0a94ea/scopus_export_Jun 18-2026_642141a5-a34e-4acb-aa31-eb18be0a94ea.ris',
);

function loadSecrets(): Record<string, string> {
  const lines = readFileSync(SECRETS_PATH, 'utf-8').split('\n');
  const secrets: Record<string, string> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    secrets[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return secrets;
}

// Minimal RIS parser (Node — mirrors app parser)
function parseRis(content: string) {
  const records: Array<{ id: string; title: string; journal: string; abstract: string; year?: number; doi?: string }> = [];
  for (const block of content.split(/\r?\n\r?\n/)) {
    let ty = '',
      title = '',
      journal = '',
      abstract = '',
      year: number | undefined,
      doi = '',
      ur = '';
    for (const line of block.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9]{2})  - (.*)$/);
      if (!m) continue;
      const [, tag, value] = m;
      switch (tag) {
        case 'TY':
          ty = value.trim();
          break;
        case 'TI':
          title = value.trim();
          break;
        case 'T2':
          journal = value.trim();
          break;
        case 'AB':
          abstract = value.trim();
          break;
        case 'PY':
          year = parseInt(value.trim(), 10) || undefined;
          break;
        case 'DO':
          doi = value.trim();
          break;
        case 'UR':
          ur = value.trim();
          break;
      }
    }
    if (ty !== 'JOUR' || !title) continue;
    let id = doi ? `doi:${doi.toLowerCase()}` : ur.match(/publications\/(\d+)/) ? `scopus:${ur.match(/publications\/(\d+)/)![1]}` : `hash:${title.slice(0, 40)}`;
    records.push({ id, title, journal: journal || 'Unknown journal', abstract: abstract || '(No abstract)', year, doi: doi || undefined });
  }
  return records;
}

async function encryptJson(data: unknown, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  );
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
  const b64 = (buf: ArrayBuffer | Uint8Array) => Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString('base64');
  return { ciphertext: b64(ciphertext), iv: b64(iv), salt: b64(salt), version: 1 };
}

async function main() {
  const secrets = loadSecrets();
  const apiUrl = secrets.WORKER_URL!;
  const risPath = process.argv[2] || RIS_DEFAULT;

  if (!existsSync(risPath)) {
    console.error('RIS file not found:', risPath);
    process.exit(1);
  }

  const content = readFileSync(risPath, 'utf-8');
  const records = parseRis(content);
  console.log(`Parsed ${records.length} records`);

  const loginRes = await fetch(`${apiUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: secrets.ADMIN_USERNAME,
      password: secrets.ADMIN_PASSWORD,
      role: 'admin',
    }),
  });
  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }
  const { token } = (await loginRes.json()) as { token: string };

  const payload = await encryptJson(records, secrets.PROJECT_PASSWORD!);
  const uploadRes = await fetch(`${apiUrl}/api/papers`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!uploadRes.ok) {
    console.error('Upload failed:', await uploadRes.text());
    process.exit(1);
  }
  console.log(`Uploaded ${records.length} encrypted papers successfully.`);
}

main();
