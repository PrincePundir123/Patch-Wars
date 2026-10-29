import { expect, test } from '@playwright/test';
test('closing an owned match requires confirmation, frees the slot and lets the owner create another', async ({
  page,
}) => {
  await page.goto('/demo');
  await expect(page.locator('canvas')).toBeVisible();
  const id = new URL(page.url()).searchParams.get('room')!;
  const spectator = await page.context().newPage();
  await spectator.goto(`/spectate/${id}`);
  await expect(spectator.locator('canvas')).toBeVisible();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Close match', exact: true }).click();
  expect((await page.request.get(`/api/rooms/${id}`)).status()).toBe(200);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Close match', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Match closed. A slot is now available.');
  expect((await page.request.get(`/api/rooms/${id}`)).status()).toBe(404);
  await expect(spectator.getByText('Match unavailable.', { exact: false })).toBeVisible();
  await spectator.close();
  await page.getByRole('button', { name: 'Launch local replay', exact: false }).click();
  await expect(page.locator('canvas')).toBeVisible();
  const next = new URL(page.url()).searchParams.get('room')!;
  expect(next).not.toBe(id);
  await page.goto('/dashboard');
  await expect(
    page.getByRole('button', { name: `Close demo match ${next.slice(0, 8)}`, exact: true }),
  ).toBeVisible();
});
