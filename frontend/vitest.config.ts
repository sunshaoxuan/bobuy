import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Bound worker contention on the shared workstation; keep all test/coverage gates.
    maxWorkers: 4,
    minWorkers: 1,
    environment: 'jsdom',
    passWithNoTests: true,
    setupFiles: './src/test/setup.ts',
    exclude: ['node_modules/**', 'dist/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'src/test/'],
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60
    }
  }
});
