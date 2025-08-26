import { test, expect } from '@playwright/test';
import { configureTestLogger } from '../src/utils/logger.js';

// テスト用ロガーを設定
const testLogger = configureTestLogger();

test.describe('Debug OAuth Flow', () => {
  test.beforeAll(async () => {
    // Authlete設定が必要かチェック
    if (!process.env.AUTHLETE_SERVICE_ACCESS_TOKEN) {
      test.skip('AUTHLETE_SERVICE_ACCESS_TOKEN is not set');
    }
  });

  test('debug oauth authorization flow step by step', async ({ page }) => {
    testLogger.info('1. Starting OAuth flow debug test...');
    
    // 1. ログインページにアクセス
    testLogger.info('2. Going to login page...');
    await page.goto('https://localhost:3443/auth/login');
    await page.screenshot({ path: 'debug-step1-login-page.png' });
    
    // ログインフォームを入力
    testLogger.info('3. Filling login form...');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');
    await page.screenshot({ path: 'debug-step2-login-filled.png' });
    
    // ログイン実行
    testLogger.info('4. Clicking login button...');
    await page.click('button[type="submit"]');
    
    // ログイン後の状態を確認
    testLogger.info('5. After login - waiting and checking URL...');
    await page.waitForTimeout(2000);
    testLogger.info('Current URL after login:', page.url());
    await page.screenshot({ path: 'debug-step3-after-login.png' });
    
    // 2. OAuth認可エンドポイントにアクセス
    testLogger.info('6. Going to OAuth authorize endpoint...');
    const authUrl = new URL('https://localhost:3443/oauth/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', 'confidential-test-client'); // 実際のAuthlete Client ID
    authUrl.searchParams.set('redirect_uri', 'https://localhost:3443/callback');
    authUrl.searchParams.set('scope', 'tickets:read tickets:write');
    authUrl.searchParams.set('state', 'test-state-123');
    
    // PKCE パラメータ
    authUrl.searchParams.set('code_challenge', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    authUrl.searchParams.set('code_challenge_method', 'S256');

    testLogger.debug('OAuth URL:', authUrl.toString());
    await page.goto(authUrl.toString());
    
    // OAuth認可後の状態を確認
    testLogger.info('7. After OAuth authorize request - checking...');
    await page.waitForTimeout(3000);
    testLogger.info('Current URL after OAuth request:', page.url());
    await page.screenshot({ path: 'debug-step4-oauth-authorize.png' });
    
    // ページの内容を取得してログ出力
    const content = await page.content();
    testLogger.info('Page content length:', content.length);
    testLogger.info('Page title:', await page.title());
    
    // h1要素があるかチェック
    const h1Elements = await page.locator('h1').count();
    testLogger.info('Number of h1 elements:', h1Elements);
    
    if (h1Elements > 0) {
      const h1Text = await page.locator('h1').first().textContent();
      testLogger.info('First h1 text:', h1Text);
    }
    
    // エラーメッセージがあるかチェック
    const errorElements = await page.locator('.error, .alert-danger, [class*="error"]').count();
    testLogger.info('Number of error elements:', errorElements);
    
    if (errorElements > 0) {
      const errorText = await page.locator('.error, .alert-danger, [class*="error"]').first().textContent();
      testLogger.error('Error text:', errorText);
    }
  });
});