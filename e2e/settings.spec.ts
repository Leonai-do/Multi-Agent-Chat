import { test, expect } from '@playwright/test';

const LS_TAVILY_KEY = 'tavily-api-key';

test.describe('Settings modal', () => {
  test('edit and persist Tavily and Groq keys and providers', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open settings' }).click();
    const input = page.locator('#tavily-api-key');
    await expect(input).toBeVisible();
    const key = 'test-tavily-key-123';
    await input.fill(key);
    // Groq key
    const groq = page.locator('#groq-api-key');
    await expect(groq).toBeVisible();
    const groqKey = 'test-groq-key-456';
    await groq.fill(groqKey);

    // Providers
    const globalProvider = page.getByLabel('Global provider select');
    await globalProvider.selectOption('groq');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Reopen and check value
    await page.getByRole('button', { name: 'Open settings' }).click();
    await expect(page.locator('#tavily-api-key')).toHaveValue(key);
    await expect(page.locator('#groq-api-key')).toHaveValue(groqKey);
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Validate in localStorage
    const stored = await page.evaluate((k) => localStorage.getItem(k), LS_TAVILY_KEY);
    expect(stored).toBe(key);
    const storedGroq = await page.evaluate((k) => localStorage.getItem(k), 'groq-api-key');
    expect(storedGroq).toBe(groqKey);
    const storedGlobalProvider = await page.evaluate((k) => localStorage.getItem(k), 'provider-global');
    expect(storedGlobalProvider).toBe('groq');
  });
});
