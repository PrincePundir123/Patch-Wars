import { build } from 'esbuild';
await build({
  entryPoints: ['apps/forge-worker/src/worker.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile: 'dist/forge/worker.js',
  sourcemap: true,
});
