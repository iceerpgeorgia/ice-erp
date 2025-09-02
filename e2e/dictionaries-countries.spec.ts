import { test, expect } from '@playwright/test';

test('dictionaries → countries shows seeded data', async ({ page }) => {
  await page.goto('/dictionaries');
  await page.getByRole('link', { name: /Countries/i }).click();

  await expect(page.getByRole('heading', { name: /Countries/i })).toBeVisible();

  // At least one seeded row should be visible (USA / United States)
  await expect(
    page.locator('text=/USA|United\s+States/i')
  ).toBeVisible();
});

