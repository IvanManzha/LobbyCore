const { test, expect } = require('@playwright/test');

test('home loads summary @smoke', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Активный турнир')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Live Cup' })).toBeVisible({ timeout: 10000 });
});
