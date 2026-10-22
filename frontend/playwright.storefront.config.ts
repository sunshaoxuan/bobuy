import { defineConfig } from '@playwright/test';

// This suite uses only the fixed Compose stack and never starts another server.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'storefront.local.spec.ts',
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:18080',
    launchOptions: process.env.BOBUY_BROWSER_PATH ? { executablePath: process.env.BOBUY_BROWSER_PATH } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
});
