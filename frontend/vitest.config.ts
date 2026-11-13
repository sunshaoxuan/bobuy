import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Bound worker contention on the shared workstation; keep all test/coverage gates.
    maxWorkers: 4,
    minWorkers: 1,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // SEO checks run separately with Node's built-in test runner.
    exclude: [...configDefaults.exclude, 'node_modules/**', 'dist/**', 'e2e/**', 'scripts/home-seo.test.mjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'src/test/']
    }
  }
});
