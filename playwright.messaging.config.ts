import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/messaging-web',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 }, trace: 'retain-on-failure' },
  webServer: { command: 'node tests/messaging-web/server.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});
