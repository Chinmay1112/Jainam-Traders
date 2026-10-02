import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      ADMIN_INITIAL_PASSWORD: 'TestOwnerPassword#2026',
      MANAGER_INITIAL_PASSWORD: 'TestManagerPassword#2026',
      STAFF_INITIAL_PASSWORD: 'TestStaffPassword#2026',
    },
    exclude: ['**/node_modules/**', '**/.kilo/**', '**/.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './tests/fixtures/empty-server-only.js'),
    },
  },
});
