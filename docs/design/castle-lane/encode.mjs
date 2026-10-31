/* global createImageBitmap, fetch, document, Buffer */
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const data = (await readFile('docs/design/castle-lane/castle-lane.png')).toString('base64');
  const result = await page.evaluate(async (data) => {
    const bitmap = await createImageBitmap(
      await (await fetch(`data:image/png;base64,${data}`)).blob(),
    );
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas.toDataURL('image/webp', 0.91).split(',')[1];
  }, data);
  await writeFile('apps/web/public/art/castle-lane.webp', Buffer.from(result, 'base64'));
} finally {
  await browser.close();
}
