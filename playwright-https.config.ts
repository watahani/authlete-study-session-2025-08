import { defineConfig, devices } from '@playwright/test';

/**
 * HTTPS環境専用のPlaywright設定
 * Self-signed証明書を使用するHTTPS開発サーバー用
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'https://localhost:3443',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* SSL証明書検証を無視 */
    ignoreHTTPSErrors: true,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium-https',
      use: { 
        ...devices['Desktop Chrome'],
        ignoreHTTPSErrors: true, // Self-signed証明書のエラーを無視
      },
    },

    // {
    //   name: 'firefox-https',
    //   use: { 
    //     ...devices['Desktop Firefox'],
    //     ignoreHTTPSErrors: true,
    //   },
    // },

    // {
    //   name: 'webkit-https',
    //   use: { 
    //     ...devices['Desktop Safari'],
    //     ignoreHTTPSErrors: true,
    //   },
    // },
  ],

  /* Run your local HTTPS dev server before starting the tests */
  webServer: {
    command: 'npm run dev:https',
    url: 'https://localhost:3443',
    reuseExistingServer: true,
    timeout: 120 * 1000,
    ignoreHTTPSErrors: true, // Self-signed証明書のエラーを無視
  },
});