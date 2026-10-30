import type { Locator, Page } from '@playwright/test';
export async function openBattlePanels(page: Page) {
  for (const name of ['Choose a soldier', 'Chat']) {
    const toggle = page.getByRole('button', { name, exact: true });
    if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  }
}

export function isVisuallyUnobscured(locator: Locator) {
  return locator.evaluate(
    (element) =>
      new Promise<boolean>((resolve) => {
        const observer = new IntersectionObserver(
          ([entry]) => {
            observer.disconnect();
            resolve((entry as IntersectionObserverEntry & { isVisible: boolean }).isVisible);
          },
          { trackVisibility: true, delay: 100 } as IntersectionObserverInit & {
            trackVisibility: boolean;
            delay: number;
          },
        );
        observer.observe(element);
      }),
  );
}
