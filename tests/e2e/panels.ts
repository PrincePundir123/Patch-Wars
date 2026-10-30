import type { Page } from '@playwright/test';
export async function openBattlePanels(page: Page) {
  for (const name of ['Choose a soldier', 'Chat']) {
    const toggle = page.getByRole('button', { name, exact: true });
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  }
}
