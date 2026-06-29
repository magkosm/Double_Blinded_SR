import { defineConfig, devices } from '@playwright/test';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173/Double_Blinded_SR/';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'bash scripts/e2e-server.sh',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        cwd: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
        timeout: 120_000,
      },
});
