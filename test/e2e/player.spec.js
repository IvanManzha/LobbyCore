const { test, expect } = require('@playwright/test');

test('player profile renders metrics and history @smoke', async ({ page }) => {
  await page.goto('/player/Alice', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Matches played')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Fixture Cup')).toBeVisible({ timeout: 10000 });
});
