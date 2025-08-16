import { defineConfig, devices } from '@playwright/test';

/**
 * DCRテスト用のPlaywright設定
 * OAuth有効モードでサーバーを起動してDCRテストを実行
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: false, // DCRテストはシリアル実行
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1, // DCRテストは単一ワーカーで実行
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'https://localhost:3443',

    /* Ignore HTTPS certificate errors for self-signed certificates */
    ignoreHTTPSErrors: true,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'HTTPS_ENABLED=true MCP_OAUTH_ENABLED=false npm run dev:https',
    url: 'https://localhost:3443',
    reuseExistingServer: !process.env.CI, // CI環境では既存サーバーを再利用しない
    timeout: 120 * 1000,
    ignoreHTTPSErrors: true,
    env: {
      HTTPS_ENABLED: 'true',
      MCP_OAUTH_ENABLED: 'false',
      NODE_ENV: 'test',
      LOG_LEVEL: 'debug',
      AUTHLETE_SERVICE_ACCESS_TOKEN: process.env.AUTHLETE_SERVICE_ACCESS_TOKEN || '',
      AUTHLETE_SERVICE_ID: process.env.AUTHLETE_SERVICE_ID || '',
      AUTHLETE_BASE_URL: process.env.AUTHLETE_BASE_URL || '',
    }
  },
});