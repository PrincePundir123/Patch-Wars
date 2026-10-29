import 'dotenv/config';
import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
const backend =
  process.env.EXTENSION_BACKEND_URL || process.env.WEB_ORIGIN || 'http://localhost:5173';
const url = new URL(backend);
if (
  url.username ||
  url.password ||
  url.search ||
  url.hash ||
  url.pathname !== '/' ||
  !['https:', 'http:'].includes(url.protocol)
)
  throw new Error('EXTENSION_BACKEND_URL must be an HTTP(S) origin.');
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('A public extension backend requires HTTPS.');
await mkdir('dist/extension', { recursive: true });
await build({
  entryPoints: ['apps/extension/viewer.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: false,
  outfile: 'dist/extension/viewer.js',
  define: { PATCH_WARS_BACKEND: JSON.stringify(url.origin) },
});
for (const file of ['viewer.html', 'viewer.css'])
  await copyFile(`apps/extension/${file}`, `dist/extension/${file}`);
await copyFile('apps/web/public/art/unit-atlas.webp', 'dist/extension/unit-atlas.webp');
console.log(
  'Twitch extension assets built in dist/extension. No backend secrets are included. Upload requires Twitch extension configuration and testing.',
);
