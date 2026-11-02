import { defineConfig, devices } from '@playwright/test';
// Records the film's Extension purchase flow (video/bits-flow.spec.ts) against the dev server.
export default defineConfig({
  testDir: '.',
  testMatch: 'bits-flow.spec.ts',
  timeout: 90000,
  workers: 1,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:5173',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
  },
});
