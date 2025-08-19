import { test, expect } from '@playwright/test';
import { OAuthTestHelper } from './helpers/oauth-test-helper.js';

test.describe('OAuth Authorization Code Flow', () => {
  const testHelper = new OAuthTestHelper();

  // test.beforeAll(async () => {
  //   // Authlete設定が必要かチェック
  //   if (!process.env.AUTHLETE_SERVICE_ACCESS_TOKEN) {
  //     test.skip();
  //   }
  // });

  test.beforeEach(async ({ page }) => {
    await testHelper.setupTest(page);
  });

  test.afterEach(async () => {
    await testHelper.cleanup();
  });

  test('should handle authorization code flow', async ({ page }) => {
    // 統合ヘルパーを使用してOAuth認可コードフローを実行
    const { accessToken, clientInfo } = await testHelper.performAuthorizationCodeFlow(page, {
      scope: 'tickets:read tickets:write'
    });

    // アクセストークンが正常に取得できることを確認
    expect(accessToken).toBeTruthy();
    expect(typeof accessToken).toBe('string');
    expect(accessToken.length).toBeGreaterThan(0);

    // クライアント情報が正しく設定されることを確認
    expect(clientInfo.client_id).toBe('3006291287');
  });

  test('should show consent page with proper client information', async ({ page }) => {
    // 認可エンドポイントに直接アクセス（ログイン済み状態で）
    const authUrl = new URL('https://localhost:3443/oauth/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', '3006291287');
    authUrl.searchParams.set('redirect_uri', 'https://localhost:3443/oauth/callback');
    authUrl.searchParams.set('scope', 'tickets:read tickets:write');
    authUrl.searchParams.set('state', 'test-state-123');
    authUrl.searchParams.set('code_challenge', 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    authUrl.searchParams.set('code_challenge_method', 'S256');

    await page.goto(authUrl.toString());

    // 同意画面が表示されることを確認
    await expect(page.locator('h1')).toContainText('アプリケーション認可');
    await expect(page.locator('.client-info')).toBeVisible();
    await expect(page.locator('.scopes')).toBeVisible();
    
    // スコープ情報が正しく表示されることを確認
    const scopeElements = await page.locator('.scopes .scope-item').all();
    expect(scopeElements.length).toBeGreaterThan(0);
  });
});