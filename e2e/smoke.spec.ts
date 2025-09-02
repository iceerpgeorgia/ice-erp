import { test, expect } from '@playwright/test';

test('homepage renders heading', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: /Next\.js \+ Postgres \+ Google Sign-In/i })
  ).toBeVisible();
});

