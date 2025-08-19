/**
 * OAuth Authorization Details テスト
 * 
 * 詳細な権限制御機能のテストを行います
 */

import { test, expect } from '@playwright/test';
import { OAuthTestHelper, AuthorizationCodeFlowOptions } from './helpers/oauth-test-helper.js';
import { oauthLogger } from '../src/utils/logger.js';

test.describe('OAuth Authorization Details', () => {
  const testHelper = new OAuthTestHelper();
  
  test.beforeEach(async ({ page }) => {
    await testHelper.setupTest(page);
  });

  test.afterEach(async () => {
    await testHelper.cleanup();
  });

  test('標準権限でのチケット予約が成功する', async ({ page }) => {
    // OAuth認可フローを実行（標準権限）
    const { accessToken } = await testHelper.performAuthorizationCodeFlow(page, {
      scope: 'mcp:tickets:read mcp:tickets:write',
      authorizationDetails: 'scope-only' // 標準権限を選択
    });

    // MCPエンドポイントでチケット予約を実行
    const ticketId = 1;
    const seats = 2;
    
    const mcpResponse = await testHelper.callMCPEndpoint(page, accessToken, 'reserve_ticket', {
      ticket_id: ticketId,
      seats: seats
    });

    expect(mcpResponse.status()).toBe(200);
    
    const responseData = await mcpResponse.json();
    oauthLogger.debug('MCP Response Data:', responseData);
    
    // MCPレスポンス構造を確認（result.content[0].text）
    expect(responseData.result).toBeTruthy();
    expect(responseData.result.content).toBeTruthy();
    expect(responseData.result.content[0].text).toContain('チケット予約が完了しました');
    
    oauthLogger.info('Standard authorization test completed successfully');
  });

  test('金額制限付きauthorization detailsでの制限内予約が成功する', async ({ page }) => {
    // カスタム制限での認可フロー（10,000円以内）
    const { accessToken } = await testHelper.performAuthorizationCodeFlow(page, {
      scope: 'mcp:tickets:read mcp:tickets:write',
      authorizationDetails: 'custom',
      maxAmount: 10000
    });

    // 制限内のチケット予約（5,000円 × 1席 = 5,000円）
    const mcpResponse = await testHelper.callMCPEndpoint(page, accessToken, 'reserve_ticket', {
      ticket_id: 1, // Authlete勉強会（5,000円）
      seats: 1
    });

    expect(mcpResponse.status()).toBe(200);
    
    const responseData = await mcpResponse.json();
    oauthLogger.debug('MCP Response Data:', responseData);
    
    // MCPレスポンス構造を確認（result.content[0].text）
    expect(responseData.result).toBeTruthy();
    expect(responseData.result.content).toBeTruthy();
    expect(responseData.result.content[0].text).toContain('チケット予約が完了しました');
    
    oauthLogger.info('Amount limit authorization test completed successfully');
  });

  test('金額制限付きauthorization detailsでの制限超過予約が失敗する', async ({ page }) => {
    // カスタム制限での認可フロー（10,000円以内）
    const { accessToken } = await testHelper.performAuthorizationCodeFlow(page, {
      scope: 'mcp:tickets:read mcp:tickets:write',
      authorizationDetails: 'custom',
      maxAmount: 10000
    });

    // 制限超過のチケット予約（8,000円 × 2席 = 16,000円）
    const mcpResponse = await testHelper.callMCPEndpoint(page, accessToken, 'reserve_ticket', {
      ticket_id: 2, // Node.js ワークショップ（8,000円）
      seats: 2
    });

    expect(mcpResponse.status()).toBe(200);
    
    const responseData = await mcpResponse.json();
    oauthLogger.debug('MCP Error Response Data:', responseData);
    
    // エラーレスポンスの構造を確認
    expect(responseData.result).toBeTruthy();
    expect(responseData.result.isError).toBe(true);
    expect(responseData.result.content[0].text).toContain('予約制限エラー');
    expect(responseData.result.content[0].text).toContain('許可された上限');
    
    oauthLogger.info('Amount limit exceeded authorization test completed successfully');
  });

});