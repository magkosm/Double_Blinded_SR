/**
 * Promotes legacy auth:admin to auth:super_admin on the live Worker KV.
 * Requires BOOTSTRAP_TOKEN and WORKER_URL in .secrets.local.
 *
 * Usage: npm run upgrade-super-admin
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SECRETS_PATH = resolve(ROOT, '.secrets.local');

function loadSecrets(): Record<string, string> {
  if (!existsSync(SECRETS_PATH)) {
    console.error('Missing .secrets.local');
    process.exit(1);
  }
  const secrets: Record<string, string> = {};
  for (const line of readFileSync(SECRETS_PATH, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    secrets[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return secrets;
}

async function main() {
  const secrets = loadSecrets();
  const apiUrl = secrets.WORKER_URL;
  const token = secrets.BOOTSTRAP_TOKEN;
  if (!apiUrl || !token) {
    console.error('WORKER_URL and BOOTSTRAP_TOKEN required in .secrets.local');
    process.exit(1);
  }

  const res = await fetch(`${apiUrl}/api/bootstrap/upgrade-super-admin`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await res.text();
  if (!res.ok) {
    console.error(`Upgrade failed (${res.status}):`, body);
    process.exit(1);
  }

  console.log('Super-admin upgrade:', body);
  console.log('You can now sign in at /admin with your existing admin credentials.');
}

main();
