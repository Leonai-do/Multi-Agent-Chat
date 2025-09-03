import { test, expect } from '@playwright/test';

test.describe('Copy message action', () => {
  test('copies the user message text', async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-ignore
      window.__copied = '';
      // @ts-ignore
      navigator.clipboard = {
        // @ts-ignore
        ...navigator.clipboard,
        writeText: (t: string) => {
          // @ts-ignore
          window.__copied = t;
          return Promise.resolve();
        },
      } as any;

      const origExec = document.execCommand;
      // @ts-ignore
      document.execCommand = (commandId: string, ...args: any[]) => {
        if (commandId === 'copy') {
          // Try to read from the activeElement (textarea fallback path)
          const ae = document.activeElement as HTMLTextAreaElement | null;
          // @ts-ignore
          window.__copied = (ae && 'value' in ae) ? (ae as any).value : '';
          return true;
        }
        return origExec.call(document, commandId, ...args);
      };
    });

    await page.goto('/');
    const text = 'Copy me please';
    await page.locator('.chat-input__text-field').fill(text);
    await page.keyboard.press('Enter');

    // Find the first message item copy button (user message)
    const copyBtn = page.getByRole('button', { name: 'Copy message' }).first();
    await copyBtn.click();

    const copied = await page.evaluate(() => (window as any).__copied);
    expect(copied).toContain(text);
  });
});
