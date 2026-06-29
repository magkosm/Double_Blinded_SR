import { test, expect } from '@playwright/test';

test.describe('UI smoke', () => {
  test('home page renders', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByText('Double-Blinded SR')).toBeVisible();
  });

  test('reviewer login page renders', async ({ page }) => {
    await page.goto('./r/default');
    await expect(page.getByRole('heading', { name: /title.*abstract screening/i })).toBeVisible();
    await expect(page.getByRole('textbox').first()).toBeVisible();
  });

  test('super-admin login page renders', async ({ page }) => {
    await page.goto('./admin');
    await expect(page.getByRole('heading', { name: /super admin/i })).toBeVisible();
  });
});

test.describe('authenticated flows', () => {
  test.skip(
    !process.env.E2E_ADMIN_USER || !process.env.E2E_ADMIN_PASS,
    'Set E2E_ADMIN_USER and E2E_ADMIN_PASS to run authenticated E2E',
  );

  test('admin can reach project password after login', async ({ page }) => {
    await page.goto('./admin/default');
    await page.getByRole('textbox').first().fill(process.env.E2E_ADMIN_USER!);
    await page.locator('input[type="password"]').fill(process.env.E2E_ADMIN_PASS!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/project password/i)).toBeVisible({ timeout: 15_000 });
  });
});
