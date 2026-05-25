const { test, expect } = require('@playwright/test');

test('tournament leaderboard renders @smoke', async ({ page }) => {
  await page.goto('/tournament/fixture_cup', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Fixture Cup' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Alice')).toBeVisible({ timeout: 10000 });
});
