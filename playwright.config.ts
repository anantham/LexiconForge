import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for LexiconForge E2E Tests
 *
 * Focuses on initialization and IndexedDB-related tests to verify
 * database schema migrations and prevent regression of initialization issues.
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html'],
    ['list']
  ],

  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:5173',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Use existing dev server instead of starting a new one
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:5177',
  //   reuseExistingServer: true,
  //   timeout: 120 * 1000,
  // },
});
