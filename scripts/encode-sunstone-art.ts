import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

// Re-encode original generated artwork without resizing or changing sprite coordinates.
// Only an empty local browser page is used; this script makes no network requests.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const name of ['arena', 'units', 'portraits']) {
    const source = await readFile(`docs/design/sunstone/sunstone-${name}.png`);
    const encoded = await page.evaluate(
      async ({ data, quality }) => {
        const blob = await (await fetch(`data:image/png;base64,${data}`)).blob();
        const bitmap = await createImageBitmap(blob);
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
        const result = canvas.toDataURL('image/webp', quality);
        bitmap.close();
        return result.split(',')[1]!;
      },
      { data: source.toString('base64'), quality: name === 'units' ? 0.96 : 0.9 },
    );
    const output = Buffer.from(encoded, 'base64');
    await writeFile(`apps/web/public/art/sunstone-${name}.webp`, output);
    console.log(`${name}: ${source.length} -> ${output.length} bytes`);
  }
} finally {
  await browser.close();
}
