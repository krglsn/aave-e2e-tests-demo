import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';
import { getPageUrl } from './e2e/config/page-url.js';

if (existsSync('.env')) process.loadEnvFile('.env');

const desktopChrome = devices['Desktop Chrome'];

const baseURL = getPageUrl();

export default defineConfig({
  testDir: './e2e/tests',
  workers: process.env.CI ? 1 : 2,  // cloudflare rate limit may be triggered
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    ...desktopChrome,
    baseURL,
    testIdAttribute: 'data-cy',
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
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
    // {
    //   name: 'desktop-4k',
    //   use: {
    //     viewport: { width: 3840, height: 2160 },
    //     screen: { width: 3840, height: 2160 },
    //     deviceScaleFactor: 1,
    //   },
    // },
  ],
});
