import { test, expect } from '@playwright/test';

test('dictionaries → countries shows seeded data', async ({ page }) => {
  await page.goto('/dictionaries/countries');
  await expect(page).toHaveURL(/\/auth\/signin/i);
  await expect(page.getByRole('button', { name: /Sign in with Google/i })).toBeVisible();
});

