import { test, expect } from '@playwright/test';

test('homepage renders heading', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ICE ERP/i);
  await expect(page.getByRole('link', { name: /^Home$/i })).toBeVisible();
});

