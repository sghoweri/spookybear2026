import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the built site (yarn build && yarn preview).
 *   yarn test            run everything headless
 *   yarn test:ui         Playwright UI mode
 *   BASE_URL=https://spookybear2026.com yarn test   run against production
 */
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:4322';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    timezoneId: 'America/New_York',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } }, // Chromium-based so only one browser download is needed
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'yarn build && node scripts/serve-dist.mjs 4322',
        url: 'http://127.0.0.1:4322',
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
