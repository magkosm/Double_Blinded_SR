/**
 * Migrates v0.5 flat KV keys to review:default:* namespace.
 * Run locally with CLOUDFLARE credentials — does NOT run automatically.
 *
 * Usage: npm run migrate -w scripts
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
  const accountId = secrets.CLOUDFLARE_ACCOUNT_ID;
  const token = secrets.CLOUDFLARE_API_TOKEN;
  const namespaceId = secrets.KV_NAMESPACE_ID || '94974aa587864373b629fd0614d5a777';

  if (!accountId || !token) {
    console.error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN required');
    process.exit(1);
  }

  const slug = 'default';
  const mappings: [string, string][] = [
    ['auth:admin', `review:${slug}:auth:admin`],
    ['data:papers', `review:${slug}:data:papers`],
    ['data:rubric', `review:${slug}:data:rubric`],
    ['meta:reviewers', `review:${slug}:meta:reviewers`],
  ];

  console.log('Migration plan (manual KV copy via API):');
  for (const [from, to] of mappings) {
    console.log(`  ${from} → ${to}`);
  }
  console.log('\nAlso copy auth:reviewer:* and data:decisions:* to review:default:...');
  console.log('Create review:default:meta and meta:reviews listing ["default"]');
  console.log('\nFor production, use wrangler kv bulk export/import or Cloudflare dashboard.');
  console.log('Account:', accountId, 'Namespace:', namespaceId);
}

main();
