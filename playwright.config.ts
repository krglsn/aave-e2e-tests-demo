import { defineConfig, devices } from '@playwright/test';

const desktopChrome = devices['Desktop Chrome'];

const baseURL = process.env.BASE_URL ?? 'https://app.aave.com';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    ...desktopChrome,
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-1920',
      use: {
        viewport: { width: 1920, height: 1080 },
        screen: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      },
    },
    {
      name: 'desktop-4k',
      use: {
        viewport: { width: 3840, height: 2160 },
        screen: { width: 3840, height: 2160 },
        deviceScaleFactor: 1,
      },
    },
  ],
});
