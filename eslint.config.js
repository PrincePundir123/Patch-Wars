import js from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  {
    ignores: [
      '.data/**',
      'dist/**',
      'node_modules/**',
      'apps/web/dist/**',
      'playwright-report/**',
      'test-results/**',
      // Film tooling: Node + browser scripts run outside the app build.
      'video/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
);
