/**
 * Sync credentials.local from .secrets.local (human-readable reference).
 * Usage: npm run sync-credentials
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadSecrets(): Record<string, string> {
  const path = resolve(ROOT, '.secrets.local');
  if (!existsSync(path)) {
    console.error('Missing .secrets.local');
    process.exit(1);
  }
  const secrets: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    secrets[t.slice(0, eq)] = t.slice(eq + 1);
  }
  return secrets;
}

function main() {
  const s = loadSecrets();
  const pages =
    s.GITHUB_PAGES_URL?.replace('magkos.github.io', 'magkosm.github.io') ||
    'https://magkosm.github.io/Double_Blinded_SR/';
  const worker = s.WORKER_URL || s.VITE_API_URL || '(not set)';
  const now = new Date().toISOString().slice(0, 10);

  const content = `# Credentials reference — LOCAL ONLY, NEVER COMMIT
# Last synced: ${now} (npm run sync-credentials)

## Live URLs

| Service | URL |
|---------|-----|
| App | ${pages} |
| Super-admin | ${pages}admin |
| Review admin (default) | ${pages}admin/default |
| Reviewer (default) | ${pages}r/default |
| Worker API | ${worker} |

---

## Super-admin & review admin

| Field | Value |
|-------|-------|
| Username | ${s.ADMIN_USERNAME || '(set ADMIN_USERNAME in .secrets.local)'} |
| Password | ${s.ADMIN_PASSWORD || '(set ADMIN_PASSWORD)'} |

> Same credentials work for \`/admin\` (super-admin) and \`/admin/default\` (review admin)
> until you create separate review admins per study.

---

## Project password

| Field | Value |
|-------|-------|
| Project password | ${s.PROJECT_PASSWORD || '(set PROJECT_PASSWORD)'} |

Enter this in the browser after admin login. Required to decrypt/upload papers.

---

## Reviewer accounts

Add rows when you create reviewers in the admin panel:

| Username | Password | Review slug |
|----------|----------|-------------|
| (created in admin UI) | one-time modal | default |

---

## Maintenance commands

\`\`\`bash
npm run upgrade-super-admin   # legacy → super-admin KV (once)
npm run sync-credentials      # refresh this file from .secrets.local
\`\`\`

Infrastructure secrets (tokens, JWT): see \`.secrets.local\` only — not duplicated here.

Full setup guide: docs/deployment/credentials-and-setup.md
`;

  const out = resolve(ROOT, 'credentials.local');
  writeFileSync(out, content);
  console.log(`Wrote ${out}`);
}

main();
