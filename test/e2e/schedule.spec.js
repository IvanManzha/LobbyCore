const { test, expect } = require('@playwright/test');

test('schedule shows tournaments @smoke', async ({ page }) => {
  await page.goto('/schedule', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Fixture Cup')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Завершенные' }).click();
  await expect(page.getByText('Fixture Cup')).toBeVisible({ timeout: 10000 });
});
