import { test, expect } from '@playwright/test';

test.describe('Debug Denial Flow', () => {
  test.beforeAll(async () => {
    if (!process.env.AUTHLETE_SERVICE_ACCESS_TOKEN) {
      test.skip('AUTHLETE_SERVICE_ACCESS_TOKEN is not set');
    }
  });

  test('debug denial flow step by step', async ({ page }) => {
    console.log('1. Starting denial flow debug test...');
    
    // 1. ログイン
    console.log('2. Going to login page...');
    await page.goto('https://localhost:3443/auth/login');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    console.log('3. Login completed, current URL:', page.url());
    
    // 2. OAuth認可エンドポイント
    console.log('4. Going to OAuth authorize endpoint...');
    const authUrl = new URL('https://localhost:3443/oauth/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', '2701499366');
    authUrl.searchParams.set('redirect_uri', 'https://localhost:3443/callback');
    authUrl.searchParams.set('scope', 'tickets:read');
    authUrl.searchParams.set('state', 'test-state-456');
    
    // PKCE パラメータを追加
    authUrl.searchParams.set('code_challenge', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    authUrl.searchParams.set('code_challenge_method', 'S256');

    await page.goto(authUrl.toString());
    await page.waitForTimeout(3000);
    
    console.log('5. After OAuth request, current URL:', page.url());
    await page.screenshot({ path: 'debug-denial-consent.png' });
    
    // 3. 同意画面の要素を詳細チェック
    console.log('6. Checking consent page elements...');
    
    const h1Elements = await page.locator('h1').count();
    console.log('Number of h1 elements:', h1Elements);
    
    const approveButtons = await page.locator('button.approve').count();
    console.log('Number of approve buttons:', approveButtons);
    
    const denyButtons = await page.locator('button.deny').count();
    console.log('Number of deny buttons:', denyButtons);
    
    const allButtons = await page.locator('button').count();
    console.log('Total number of buttons:', allButtons);
    
    // すべてのボタンの詳細情報を取得
    const buttons = await page.locator('button').all();
    for (let i = 0; i < buttons.length; i++) {
      const button = buttons[i];
      const text = await button.textContent();
      const className = await button.getAttribute('class');
      const type = await button.getAttribute('type');
      console.log(`Button ${i}: text="${text}", class="${className}", type="${type}"`);
    }
    
    if (denyButtons > 0) {
      console.log('7. Found deny button, clicking...');
      await page.click('button.deny');
      await page.waitForTimeout(3000);
      
      console.log('8. After deny click, current URL:', page.url());
      await page.screenshot({ path: 'debug-after-denial.png' });
      
      // URLにエラーパラメータが含まれているかチェック
      const currentUrl = page.url();
      console.log('Final URL contains error:', currentUrl.includes('error'));
      console.log('Final URL contains access_denied:', currentUrl.includes('access_denied'));
      console.log('Final URL contains callback:', currentUrl.includes('callback'));
    } else {
      console.log('7. No deny button found!');
      
      // ページの内容を出力
      const content = await page.content();
      console.log('Page content length:', content.length);
      console.log('Page content (first 500 chars):', content.substring(0, 500));
    }
  });
});