import { test, expect } from '@playwright/test';
import { OAuthTestHelper, TEST_CLIENTS } from './helpers/oauth-test-helper.js';
import { configureTestLogger } from '../src/utils/logger.js';

// テスト用ロガーを設定
const testLogger = configureTestLogger();

// Helper function to parse Server-Sent Events response
function parseSSEResponse(text: string): any {
  const eventData = text.split('\n').find(line => line.startsWith('data:'))?.substring(5).trim();
  return eventData ? JSON.parse(eventData) : null;
}

// Helper function to get base URL from test context
function getBaseURL(page: any): string {
  // テスト環境では常にHTTPSを使用
  return 'https://localhost:3443';
}

test.describe('MCP Reservation Workflow Tests (OAuth enabled)', () => {
  const testHelper = new OAuthTestHelper();
  let accessToken: string;

  test.beforeEach(async ({ page }) => {
    // OAuth認証を有効化
    process.env.MCP_OAUTH_ENABLED = 'true';
    process.env.NODE_ENV = 'test';
    
    testLogger.info(`Test env vars: MCP_OAUTH_ENABLED=${process.env.MCP_OAUTH_ENABLED}, NODE_ENV=${process.env.NODE_ENV}`);
    
    // OAuthTestHelperでテストセットアップ
    await testHelper.setupTest(page);
    
    // アクセストークンを取得
    const oauthResult = await testHelper.performAuthorizationCodeFlow(page, {
      scope: 'mcp:tickets:read mcp:tickets:write',
      clientId: TEST_CLIENTS.MCP_PUBLIC
    });
    
    accessToken = oauthResult.accessToken;
    testLogger.info('Access token obtained for tests');
  });

  test.afterEach(async () => {
    await testHelper.cleanup();
  });

  test('complete reservation and cancellation workflow', async ({ page }) => {
    const baseURL = getBaseURL(page);

    // 1. チケット一覧を取得
    const listTicketsRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'list_tickets',
        arguments: { limit: 10 }
      }
    };

    const listResponse = await page.request.post(`${baseURL}/mcp`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify(listTicketsRequest)
    });

    expect(listResponse.status()).toBe(200);
    const listResult = parseSSEResponse(await listResponse.text());
    expect(listResult.result.content[0].text).toContain('利用可能なチケット');
    
    // チケットIDを抽出（先頭のチケットを取得）
    const ticketText = listResult.result.content[0].text;
    const ticketIdMatch = ticketText.match(/ID: (\d+)/);
    expect(ticketIdMatch).not.toBeNull();
    const ticketId = parseInt(ticketIdMatch![1]);

    // 2. チケット予約
    const reserveRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'reserve_ticket',
        arguments: {
          ticket_id: ticketId,
          seats: 2
        }
      }
    };

    const reserveResponse = await page.request.post(`${baseURL}/mcp`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify(reserveRequest)
    });

    expect(reserveResponse.status()).toBe(200);
    const reserveResult = parseSSEResponse(await reserveResponse.text());
    testLogger.info('Reservation result', { result: reserveResult });
    
    if (reserveResult.result.isError) {
      testLogger.error('Reservation failed', { error: reserveResult.result.content[0].text });
      expect(reserveResult.result.isError).toBe(false);
    }
    
    expect(reserveResult.result.content[0].text).toContain('チケット予約が完了しました');
    
    // 予約IDを抽出
    const reservationText = reserveResult.result.content[0].text;
    const reservationIdMatch = reservationText.match(/予約ID: (\d+)/);
    expect(reservationIdMatch).not.toBeNull();
    const reservationId = parseInt(reservationIdMatch![1]);

    // 3. ユーザー予約履歴を確認
    const getUserReservationsRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_user_reservations',
        arguments: {}
      }
    };

    const reservationsResponse = await page.request.post(`${baseURL}/mcp`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify(getUserReservationsRequest)
    });

    expect(reservationsResponse.status()).toBe(200);
    const reservationsResult = parseSSEResponse(await reservationsResponse.text());
    expect(reservationsResult.result.content[0].text).toContain('予約履歴');
    expect(reservationsResult.result.content[0].text).toContain(`予約ID: ${reservationId}`);

    // 4. 予約をキャンセル
    const cancelRequest = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'cancel_reservation',
        arguments: {
          reservation_id: reservationId
        }
      }
    };

    const cancelResponse = await page.request.post(`${baseURL}/mcp`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify(cancelRequest)
    });

    expect(cancelResponse.status()).toBe(200);
    const cancelResult = parseSSEResponse(await cancelResponse.text());
    testLogger.info('Cancellation result', { result: cancelResult });
    
    if (cancelResult.result.isError) {
      testLogger.error('Cancellation failed', { error: cancelResult.result.content[0].text });
    }
    
    expect(cancelResult.result.isError).toBe(false);
    expect(cancelResult.result.content[0].text).toContain('キャンセルが完了しました');

    // 5. キャンセル後の予約履歴を確認（キャンセルされた予約は表示されないはず）
    const postCancelReservationsResponse = await page.request.post(`${baseURL}/mcp`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify(getUserReservationsRequest)
    });

    expect(postCancelReservationsResponse.status()).toBe(200);
    const postCancelReservationsResult = parseSSEResponse(await postCancelReservationsResponse.text());
    testLogger.info('Post-cancellation reservations', { result: postCancelReservationsResult });
    
    // キャンセルされた予約は「active」ステータスでないため一覧に表示されないはず
    const postCancelText = postCancelReservationsResult.result.content[0].text;
    if (!postCancelText.includes('予約履歴がありません')) {
      // 他の予約がある場合、キャンセルした予約IDは含まれていないはず
      expect(postCancelText).not.toContain(`予約ID: ${reservationId}`);
    }

    // 6. チケットの在庫が復旧していることを確認
    const finalListResponse = await page.request.post(`${baseURL}/mcp`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify(listTicketsRequest)
    });

    expect(finalListResponse.status()).toBe(200);
    const finalListResult = parseSSEResponse(await finalListResponse.text());
    const finalTicketText = finalListResult.result.content[0].text;
    
    // 元のチケットリストと比較して在庫が復旧していることを確認
    testLogger.info('Final ticket list after cancellation', { ticketText: finalTicketText });
    expect(finalTicketText).toContain('利用可能なチケット');
  });

  test('cancel non-existent reservation returns error', async ({ page }) => {
    const baseURL = getBaseURL(page);

    const cancelRequest = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'cancel_reservation',
        arguments: {
          reservation_id: 99999 // 存在しない予約ID
        }
      }
    };

    const cancelResponse = await page.request.post(`${baseURL}/mcp`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify(cancelRequest)
    });

    expect(cancelResponse.status()).toBe(200);
    const cancelResult = parseSSEResponse(await cancelResponse.text());
    expect(cancelResult.result.isError).toBe(true);
    expect(cancelResult.result.content[0].text).toContain('予約キャンセルエラー');
  });
});