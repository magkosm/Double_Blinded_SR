import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SECRETS_PATH = resolve(ROOT, '.secrets.local');

function loadSecrets(): Record<string, string> {
  if (!existsSync(SECRETS_PATH)) {
    console.error('Missing .secrets.local');
    process.exit(1);
  }
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

function saveSecret(key: string, value: string) {
  let content = existsSync(SECRETS_PATH) ? readFileSync(SECRETS_PATH, 'utf-8') : '';
  const regex = new RegExp(`^#?\\s*${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}\n`;
  }
  writeFileSync(SECRETS_PATH, content);
}

async function main() {
  const secrets = loadSecrets();
  const apiUrl = secrets.WORKER_URL || process.env.WORKER_URL;
  if (!apiUrl) {
    console.error('Set WORKER_URL in .secrets.local or env before bootstrap');
    process.exit(1);
  }

  const bootstrapToken = secrets.BOOTSTRAP_TOKEN || randomBytes(32).toString('hex');
  if (!secrets.BOOTSTRAP_TOKEN) {
    saveSecret('BOOTSTRAP_TOKEN', bootstrapToken);
    console.log('Generated BOOTSTRAP_TOKEN (saved to .secrets.local)');
  }

  const username = secrets.ADMIN_USERNAME;
  const password = secrets.ADMIN_PASSWORD;
  if (!username || !password) {
    console.error('ADMIN_USERNAME and ADMIN_PASSWORD required in .secrets.local');
    process.exit(1);
  }

  const res = await fetch(`${apiUrl}/api/bootstrap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bootstrapToken}`,
    },
    body: JSON.stringify({ username, password }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`Bootstrap failed (${res.status}):`, body);
    process.exit(1);
  }

  console.log('Bootstrap successful:', body);
  console.log(`Super-admin "${username}" is ready. Sign in at /admin`);
  console.log('Next: create a review, bootstrap review admin, upload RIS.');
}

main();
