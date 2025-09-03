import { test, expect } from '@playwright/test';

const LS_CHATS_KEY = 'multi-agent-chats';

test.describe('Collaboration trace toggle', () => {
  test('shows and hides trace view for model message with trace', async ({ page }) => {
    await page.addInitScript(([key]) => {
      const chat = {
        id: 'trace-chat-1',
        title: 'Trace Chat',
        messages: [
          { id: 'u1', role: 'user', parts: [{ text: 'Show trace' }] },
          { id: 'm1', role: 'model', parts: [{ text: 'Final answer' }], collaborationTrace: {
              initialResponses: ['draft A', 'draft B', 'draft C', 'draft D'],
              refinedResponses: ['ref A', 'ref B', 'ref C', 'ref D']
            }
          },
        ],
      };
      localStorage.setItem(key, JSON.stringify([chat]));
    }, [LS_CHATS_KEY]);

    await page.goto('/');
    await page.getByText('Trace Chat').click();
    const collabToggle = page.locator('.message-bubble__collaboration-toggle');
    await expect(collabToggle).toBeVisible();
    await collabToggle.click();
    await expect(page.locator('.collaboration-trace-wrapper--visible')).toBeVisible();
    await collabToggle.click();
    await expect(page.locator('.collaboration-trace-wrapper--visible')).toHaveCount(0);
  });
});

