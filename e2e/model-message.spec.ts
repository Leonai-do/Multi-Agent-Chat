import { test, expect } from '@playwright/test';

const LS_CHATS_KEY = 'multi-agent-chats';

test.describe('Model message toolbar', () => {
  test('Rendered/Raw toggle switches content', async ({ page }) => {
    await page.addInitScript(([key]) => {
      const chat = {
        id: 'test-chat-1',
        title: 'Toolbar Chat',
        messages: [
          { id: 'u1', role: 'user', parts: [{ text: 'Hello' }] },
          { id: 'm1', role: 'model', parts: [{ text: 'Example code:\n\n```js\nconsole.log(42)\n```' }] },
        ],
      };
      localStorage.setItem(key, JSON.stringify([chat]));
    }, [LS_CHATS_KEY]);

    await page.goto('/');
    // Select the chat from sidebar
    await page.getByText('Toolbar Chat').click();
    const toggle = page.locator('.message-bubble__view-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click(); // to Raw
    await expect(page.locator('.message-bubble__raw-text')).toBeVisible();
    await toggle.click(); // back to Rendered
    await expect(page.locator('.message-bubble__raw-text')).toHaveCount(0);
  });
});

