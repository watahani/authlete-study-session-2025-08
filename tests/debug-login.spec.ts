import { test, expect } from '@playwright/test';

test('debug login page', async ({ page }) => {
  // ログインページにアクセス
  console.log('Going to login page...');
  await page.goto('https://localhost:3443/auth/login');
  
  // スクリーンショットを取る
  await page.screenshot({ path: 'debug-login.png' });
  
  // ページのタイトルを確認
  const title = await page.title();
  console.log('Page title:', title);
  
  // ページのHTMLを取得
  const html = await page.content();
  console.log('Page HTML length:', html.length);
  
  // フォーム要素の存在確認
  const usernameInput = page.locator('input[name="username"]');
  const passwordInput = page.locator('input[name="password"]');
  const submitButton = page.locator('button[type="submit"]');
  
  console.log('Username input visible:', await usernameInput.isVisible().catch(() => false));
  console.log('Password input visible:', await passwordInput.isVisible().catch(() => false));
  console.log('Submit button visible:', await submitButton.isVisible().catch(() => false));
  
  // 実際に要素を待機してみる
  try {
    await usernameInput.waitFor({ timeout: 5000 });
    console.log('Username input found!');
  } catch (error) {
    console.log('Username input not found:', error.message);
  }
});