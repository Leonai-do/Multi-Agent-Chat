import { test, expect } from '@playwright/test';

test.describe('Multi-Agent Gemini Chat', () => {
  test('loads and shows welcome', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Welcome to Multi-Agent Gemini Chat')).toBeVisible();
    await expect(page.locator('.chat-input__text-field')).toBeVisible();
  });

  test('send prompt and cancel/complete run cleanly', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('.chat-input__text-field');
    await input.fill('Test stop behavior');
    await input.press('Enter');

    // If Stop is available, click it; otherwise the run finished quickly
    const stopButton = page.getByRole('button', { name: 'Stop generation' }).or(page.getByText('Stop'));
    if (await stopButton.count()) {
      await stopButton.click();
    }
    // Loading indicator should eventually clear
    await expect(page.locator('.message-list__loading')).toHaveCount(0);
    // Workspace should not remain mounted
    await expect(page.locator('.agent-workspace')).toHaveCount(0);
  });

  test('toggle Internet button', async ({ page }) => {
    await page.goto('/');
    const toggle = page.locator('.internet-toggle');
    await expect(toggle).toBeVisible();
    const pressedBefore = await toggle.getAttribute('aria-pressed');
    await toggle.click();
    const pressedAfter = await toggle.getAttribute('aria-pressed');
    expect(pressedAfter).not.toBe(pressedBefore);
  });
});
