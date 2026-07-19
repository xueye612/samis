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
    // Keep the root package's Vitest run scoped to its own source tests. A
    // separate, nested `samisWeb-ui-polish` checkout may exist beside this
    // app; Vitest's default glob would otherwise collect that checkout's
    // Playwright specs and duplicate test files.
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', '**/e2e/**', 'test-results/**', 'playwright-report/**'],
  },
});
