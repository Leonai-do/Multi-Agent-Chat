import { test, expect } from '@playwright/test';

test.describe('Sidebar interactions', () => {
  test('menu toggle changes sidebar open state', async ({ page }) => {
    await page.goto('/');
    const sidebar = page.locator('.sidebar');
    const toggleMenu = page.getByRole('button', { name: 'Toggle menu' });
    const initiallyOpen = await sidebar.getAttribute('class');
    await toggleMenu.click();
    const afterToggle = await sidebar.getAttribute('class');
    expect(afterToggle).not.toBe(initiallyOpen);
  });

  test('new chat appears after sending prompt', async ({ page }) => {
    await page.goto('/');
    await page.locator('.chat-input__text-field').fill('First message');
    await page.keyboard.press('Enter');
    // A new chat titled "New Chat" should appear in history immediately
    const historyItem = page.locator('.chat-history-item__title', { hasText: 'New Chat' });
    await expect(historyItem).toBeVisible();
  });
});

