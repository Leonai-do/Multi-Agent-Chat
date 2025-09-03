import { test, expect } from '@playwright/test';

const LS_TAVILY_KEY = 'tavily-api-key';

test.describe('Settings modal', () => {
  test('edit and persist Tavily API key', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open settings' }).click();
    const input = page.locator('#tavily-api-key');
    await expect(input).toBeVisible();
    const key = 'test-tavily-key-123';
    await input.fill(key);
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Reopen and check value
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.locator('#tavily-api-key')).toHaveValue(key);
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Validate in localStorage
    const stored = await page.evaluate((k) => localStorage.getItem(k), LS_TAVILY_KEY);
    expect(stored).toBe(key);
  });
});

