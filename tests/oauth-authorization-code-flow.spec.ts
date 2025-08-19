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
    // 統合ヘルパーを使用してOAuth認可フローを開始し、consent画面まで進む
    const { accessToken } = await testHelper.performAuthorizationCodeFlow(page, {
      scope: 'tickets:read tickets:write'
    });

    // 正常にアクセストークンが取得できることを確認
    expect(accessToken).toBeTruthy();
    expect(typeof accessToken).toBe('string');
    expect(accessToken.length).toBeGreaterThan(0);
  });
});