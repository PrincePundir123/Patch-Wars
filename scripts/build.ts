import { build as bundle } from 'esbuild';
import { build as viteBuild } from 'vite';
await bundle({
  entryPoints: ['apps/server/src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  outfile: 'dist/server/index.js',
  sourcemap: true,
});
await import('./build-worker.js');
await viteBuild({ configFile: 'apps/web/vite.config.ts' });
