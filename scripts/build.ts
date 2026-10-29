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
// A local development .env must never ship React's development runtime.
// This affects only this build process; server environment checks stay runtime-based.
process.env.NODE_ENV = 'production';
await viteBuild({ configFile: 'apps/web/vite.config.ts' });
