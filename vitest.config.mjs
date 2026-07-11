import path from 'node:path';
import { defineConfig } from 'vitest/config';

process.env.TZ ??= 'Asia/Shanghai';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    exclude: ['node_modules/**', 'dist/**', 'e2e/**', 'test-results/**', 'playwright-report/**'],
  },
});
