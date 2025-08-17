import { test, expect } from '@playwright/test';
import { configureTestLogger } from '../src/utils/logger.js';

// テスト用ロガーを設定
const testLogger = configureTestLogger();

test('debug login page', async ({ page }) => {
  // ログインページにアクセス
  testLogger.info('Going to login page...');
  await page.goto('https://localhost:3443/auth/login');
  
  // スクリーンショットを取る
  await page.screenshot({ path: 'debug-login.png' });
  
  // ページのタイトルを確認
  const title = await page.title();
  testLogger.info('Page title:', title);
  
  // ページのHTMLを取得
  const html = await page.content();
  testLogger.info('Page HTML length:', html.length);
  
  // フォーム要素の存在確認
  const usernameInput = page.locator('input[name="username"]');
  const passwordInput = page.locator('input[name="password"]');
  const submitButton = page.locator('button[type="submit"]');
  
  testLogger.info('Username input visible:', await usernameInput.isVisible().catch(() => false));
  testLogger.info('Password input visible:', await passwordInput.isVisible().catch(() => false));
  testLogger.info('Submit button visible:', await submitButton.isVisible().catch(() => false));
  
  // 実際に要素を待機してみる
  try {
    await usernameInput.waitFor({ timeout: 5000 });
    testLogger.info('Username input found!');
  } catch (error) {
    testLogger.warn('Username input not found:', error.message);
  }
});