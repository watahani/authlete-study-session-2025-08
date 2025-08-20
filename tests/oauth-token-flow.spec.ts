import { test, expect } from '@playwright/test';
import { OAuthTestHelper, TEST_CLIENTS } from './helpers/oauth-test-helper.js';
import { configureTestLogger } from '../src/utils/logger.js';

// テスト用ロガーを設定
const testLogger = configureTestLogger();

test.describe('OAuth 2.1 Public Client Token Flow', () => {
  const testHelper = new OAuthTestHelper();

  test.beforeEach(async ({ page }) => {
    await testHelper.setupTest(page);
  });

  test.afterEach(async () => {
    await testHelper.cleanup();
  });

  test('Complete OAuth 2.1 flow with PKCE for public client', async ({ page }) => {
    // 統合ヘルパーを使用してOAuth認可コードフローを実行
    const { accessToken, clientInfo } = await testHelper.performAuthorizationCodeFlow(page, {
      scope: 'mcp:tickets:read mcp:tickets:write profile:read',
      clientId: TEST_CLIENTS.MCP_PUBLIC
    });

    testLogger.info('OAuth flow completed successfully', {
      clientId: clientInfo.client_id,
      accessTokenPrefix: accessToken.substring(0, 20) + '...'
    });

    // 取得したアクセストークンでMCPエンドポイントにアクセス
    const mcpResponse = await testHelper.callMCPEndpoint(page, accessToken, 'tools/list', {});

    expect(mcpResponse.status()).toBe(200);
    
    const mcpData = await mcpResponse.json();
    expect(mcpData.result).toBeTruthy();
    expect(mcpData.result.tools).toBeTruthy();
    
    testLogger.info('MCP endpoint access successful:', {
      toolCount: mcpData.result.tools.length,
      tools: mcpData.result.tools.map((t: any) => t.name)
    });
  });

  test('MCP endpoint rejects invalid access token', async ({ page }) => {
    // 無効なアクセストークンでMCPエンドポイントにアクセス
    const invalidToken = 'invalid_access_token_123';
    const mcpResponse = await testHelper.callMCPEndpoint(page, invalidToken, 'tools/list', {});

    // 401 Unauthorizedまたは403 Forbiddenを期待
    expect([401, 403]).toContain(mcpResponse.status());
    
    testLogger.info('MCP endpoint correctly rejected invalid token', {
      status: mcpResponse.status()
    });
  });
});