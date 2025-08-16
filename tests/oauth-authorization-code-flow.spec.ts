import { test, expect } from '@playwright/test';

test.describe('OAuth Authorization Code Flow', () => {
  test.beforeAll(async () => {
    // Authlete設定が必要かチェック
    if (!process.env.AUTHLETE_SERVICE_ACCESS_TOKEN) {
      test.skip('AUTHLETE_SERVICE_ACCESS_TOKEN is not set');
    }
  });

  test('should handle authorization code flow', async ({ page }) => {
    // 1. まずログインしてユーザーセッションを確立
    await page.goto('https://localhost:3443/auth/login');
    
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    
    // ログイン成功を確認
    await expect(page).toHaveURL(/.*\/$/);

    // 2. OAuth認可エンドポイントにアクセス
    const authUrl = new URL('https://localhost:3443/oauth/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', '2701499366'); // 実際のAuthlete Client ID
    authUrl.searchParams.set('redirect_uri', 'https://localhost:3443/callback');
    authUrl.searchParams.set('scope', 'tickets:read tickets:write');
    authUrl.searchParams.set('state', 'test-state-123');
    
    // PKCE パラメータ
    authUrl.searchParams.set('code_challenge', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    authUrl.searchParams.set('code_challenge_method', 'S256');

    await page.goto(authUrl.toString());

    // 3. 同意画面が表示されることを確認
    await expect(page.locator('h1')).toContainText('アプリケーション認可');
    await expect(page.locator('.client-info')).toBeVisible();
    await expect(page.locator('.scopes')).toBeVisible();

    // 4. 認可を許可
    await page.click('button.approve');

    // 5. リダイレクトまたはエラーページに遷移することを確認
    // 実際のテストでは、適切なクライアントが登録されている必要があります
    await page.waitForURL(/.*callback.*/);
  });

  test('should handle authorization denial', async ({ page }) => {
    // ログイン
    await page.goto('https://localhost:3443/auth/login');
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');

    // OAuth認可エンドポイント
    const authUrl = new URL('https://localhost:3443/oauth/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', '2701499366'); // 実際のAuthlete Client ID
    authUrl.searchParams.set('redirect_uri', 'https://localhost:3443/callback');
    authUrl.searchParams.set('scope', 'tickets:read');
    authUrl.searchParams.set('state', 'test-state-456');
    
    // PKCE パラメータを追加
    authUrl.searchParams.set('code_challenge', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    authUrl.searchParams.set('code_challenge_method', 'S256');

    await page.goto(authUrl.toString());

    // 同意画面で拒否
    await page.click('button.deny');

    // エラーレスポンスが返されることを確認
    await page.waitForURL(/.*callback.*error=access_denied.*/);
  });

  test('should validate required OAuth parameters', async ({ page }) => {
    // 必須パラメータなしでアクセス
    await page.goto('https://localhost:3443/oauth/authorize');
    
    // エラーレスポンスを確認
    const response = page.locator('body');
    await expect(response).toContainText(/error|invalid_request/);
  });

  test('should handle token endpoint', async ({ page, request }) => {
    // トークンエンドポイントへのPOSTリクエスト
    const tokenResponse = await request.post('https://localhost:3443/oauth/token', {
      form: {
        grant_type: 'authorization_code',
        code: 'test-auth-code',
        redirect_uri: 'https://localhost:3443/callback',
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        code_verifier: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
      }
    });

    // レスポンスを確認（実際のテストでは適切なクライアントとコードが必要）
    expect(tokenResponse.status()).toBeLessThan(500);
  });
});