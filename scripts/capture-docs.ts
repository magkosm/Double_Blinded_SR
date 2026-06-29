import { existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium, devices } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const VERSION = process.env.DOCS_VERSION || '0.5';
const OUT_DIR = resolve(ROOT, 'docs', 'images', `v${VERSION}`);
const BASE = process.env.DOCS_BASE_URL || 'http://localhost:5173/Double_Blinded_SR';

function loadSecrets(): Record<string, string> {
  const path = resolve(ROOT, '.secrets.local');
  if (!existsSync(path)) return {};
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

async function capture(page: import('playwright').Page, name: string) {
  const file = resolve(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log('  wrote', file);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const secrets = loadSecrets();
  const adminUser = process.env.DOCS_ADMIN_USER || secrets.ADMIN_USERNAME;
  const adminPass = process.env.DOCS_ADMIN_PASS || secrets.ADMIN_PASSWORD;
  const projectPass = process.env.DOCS_PROJECT_PASS || secrets.PROJECT_PASSWORD;
  const reviewSlug = process.env.DOCS_REVIEW_SLUG || 'default';

  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const mobile = await browser.newContext({ ...devices['Pixel 5'] });

  console.log('Capturing public pages…');
  {
    const page = await desktop.newPage();
    await page.goto(`${BASE}/admin`);
    await page.waitForLoadState('networkidle');
    await capture(page, 'admin-login');
    await page.close();
  }
  {
    const page = await mobile.newPage();
    await page.goto(`${BASE}/r/${reviewSlug}`);
    await page.waitForLoadState('networkidle');
    await capture(page, 'reviewer-login');
    await page.close();
  }

  if (adminUser && adminPass) {
    console.log('Capturing authenticated admin pages…');
    const page = await desktop.newPage();
    await page.goto(`${BASE}/admin`);
    await page.getByPlaceholder(/username/i).fill(adminUser);
    await page.getByPlaceholder(/password/i).fill(adminPass);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(1500);

    if (await page.getByText(/project password/i).isVisible().catch(() => false)) {
      await capture(page, 'project-password');
      if (projectPass) {
        await page.locator('input[type="password"]').fill(projectPass);
        await page.getByRole('button', { name: /continue/i }).click();
        await page.waitForTimeout(2000);
        await capture(page, 'ris-upload');
        await capture(page, 'rubric-editor');
        await capture(page, 'reviewer-list');
      }
    }
    await page.close();
  } else {
    console.log('Skip authenticated admin captures (set DOCS_ADMIN_USER/PASS or .secrets.local)');
  }

  if (process.env.DOCS_REVIEWER_USER && process.env.DOCS_REVIEWER_PASS) {
    console.log('Capturing reviewer card…');
    const page = await mobile.newPage();
    await page.goto(`${BASE}/r/${reviewSlug}`);
    await page.getByPlaceholder(/username/i).fill(process.env.DOCS_REVIEWER_USER);
    await page.getByPlaceholder(/password/i).fill(process.env.DOCS_REVIEWER_PASS);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForTimeout(3000);
    await capture(page, 'reviewer-card');
    await page.close();
  }

  await browser.close();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
