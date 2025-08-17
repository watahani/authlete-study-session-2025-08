import { defineConfig, devices } from '@playwright/test';

/**
 * OAuth Tests用のPlaywright設定
 * OAuth認可が有効な状態でテストを実行します
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

    /* Ignore HTTPS certificate errors for self-signed certificates */
    ignoreHTTPSErrors: true,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'oauth-tests',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['**/oauth-*.spec.ts'],
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'MCP_OAUTH_ENABLED=true NODE_ENV=development npm run dev',
    url: 'https://localhost:3443',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    ignoreHTTPSErrors: true,
    env: {
      MCP_OAUTH_ENABLED: 'true',
      NODE_ENV: 'development'
    }
  },
});