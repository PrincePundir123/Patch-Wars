import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'WEB_ORIGIN');
  const webOrigin = process.env.WEB_ORIGIN || env.WEB_ORIGIN || 'http://localhost:5173';
  return {
    root: resolve('apps/web'),
    plugins: [react()],
    build: {
      outDir: resolve('dist/web'),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('commonjsHelpers') || id.includes('vite/preload-helper'))
              return 'runtime';
            // Keep Pixi's shared renderer dependencies out of the eager React entry.
            if (id.includes('/node_modules/pixi.js/')) return 'pixi';
          },
        },
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      allowedHosts: [new URL(webOrigin).hostname],
      proxy: {
        '/api': 'http://127.0.0.1:3001',
        '/auth': 'http://127.0.0.1:3001',
        '/health': 'http://127.0.0.1:3001',
        '/ws': { target: 'ws://127.0.0.1:3001', ws: true },
      },
    },
  };
});
