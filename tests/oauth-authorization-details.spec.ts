/**
 * OAuth Authorization Details テスト
 * 
 * 詳細な権限制御機能のテストを行います
 */

import { test, expect } from '@playwright/test';
import { OAuthTestHelper } from './helpers/oauth-test-helper.js';
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
    const { accessToken } = await testHelper.performOAuthFlow(page, {
      authorizationDetails: 'scope-only' // 標準権限を選択
    });

    // MCPエンドポイントでチケット予約を実行
    const ticketId = 1;
    const seats = 2;
    
    const mcpResponse = await testHelper.callMCPEndpoint(accessToken, 'reserveTicket', {
      ticket_id: ticketId,
      seats: seats
    });

    expect(mcpResponse.status).toBe(200);
    
    const responseData = await mcpResponse.json();
    expect(responseData.content[0].text).toContain('チケット予約が完了しました');
    
    oauthLogger.info('Standard authorization test completed successfully');
  });

  test('金額制限付きauthorization detailsでの制限内予約が成功する', async ({ page }) => {
    // カスタム制限での認可フロー（10,000円以内）
    const { accessToken } = await testHelper.performOAuthFlow(page, {
      authorizationDetails: 'custom',
      maxAmount: 10000
    });

    // 制限内のチケット予約（5,000円 × 1席 = 5,000円）
    const mcpResponse = await testHelper.callMCPEndpoint(accessToken, 'reserveTicket', {
      ticket_id: 1, // Authlete勉強会（5,000円）
      seats: 1
    });

    expect(mcpResponse.status).toBe(200);
    
    const responseData = await mcpResponse.json();
    expect(responseData.content[0].text).toContain('チケット予約が完了しました');
    
    oauthLogger.info('Amount limit authorization test completed successfully');
  });

  test('金額制限付きauthorization detailsでの制限超過予約が失敗する', async ({ page }) => {
    // カスタム制限での認可フロー（10,000円以内）
    const { accessToken } = await testHelper.performOAuthFlow(page, {
      authorizationDetails: 'custom',
      maxAmount: 10000
    });

    // 制限超過のチケット予約（15,000円 × 1席 = 15,000円）
    const mcpResponse = await testHelper.callMCPEndpoint(accessToken, 'reserveTicket', {
      ticket_id: 4, // コンサート プレミアム席（15,000円）
      seats: 1
    });

    expect(mcpResponse.status).toBe(200);
    
    const responseData = await mcpResponse.json();
    expect(responseData.isError).toBe(true);
    expect(responseData.content[0].text).toContain('予約制限エラー');
    expect(responseData.content[0].text).toContain('許可された上限');
    
    oauthLogger.info('Amount limit exceeded authorization test completed successfully');
  });

});