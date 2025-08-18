import { test, expect } from '@playwright/test';
import crypto from 'crypto';
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

// PKCE用のユーティリティ関数
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(codeVerifier: string): string {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

// OAuth認可付きアクセストークンを取得するヘルパー関数
async function getAccessToken(page: any): Promise<string> {
  const baseURL = getBaseURL(page);
  const clientId = '3006291287';
  const redirectUri = 'https://localhost:3443/oauth/callback';
  
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  // Authorization code取得用の変数
  let authorizationCode: string | null = null;
  
  // 302リダイレクトからcodeを抽出
  page.on('response', (response) => {
    if (response.status() === 302 && response.url().includes('/oauth/authorize/decision')) {
      const location = response.headers().location;
      if (location && location.includes('code=')) {
        const locationUrl = new URL(location);
        authorizationCode = locationUrl.searchParams.get('code');
      }
    }
  });
  
  const authUrl = new URL(`${baseURL}/oauth/authorize`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'mcp:tickets:read mcp:tickets:write');
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('resource', `${baseURL}/mcp`);
  authUrl.searchParams.set('state', 'test_state');

  await page.goto(authUrl.toString());
  
  // ログイン
  await page.waitForSelector('form', { timeout: 10000 });
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'testpass');
  await page.click('button[type="submit"]');
  
  await page.waitForTimeout(3000);
  
  // コンセントページでの承認
  if (page.url().includes('/oauth/authorize/consent')) {
    const approvalButton = await page.locator('button.approve').first();
    if (await approvalButton.isVisible()) {
      await approvalButton.click();
    }
  }
  
  // Authorization codeを待機
  let attempts = 0;
  while (!authorizationCode && attempts < 15) {
    await page.waitForTimeout(1000);
    attempts++;
  }
  
  if (!authorizationCode) {
    throw new Error('Failed to obtain authorization code');
  }
  
  // トークンエンドポイントでアクセストークンを取得
  const tokenResponse = await page.request.post(`${baseURL}/oauth/token`, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: {
      grant_type: 'authorization_code',
      client_id: clientId,
      code: authorizationCode,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }
  });

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

test.describe('MCP Server Tests', () => {
  test.beforeEach(async () => {
    // MCPは常に有効、テスト時はOAuth認可を無効化
    process.env.MCP_OAUTH_ENABLED = 'false';
    process.env.NODE_ENV = 'test';
    
    // デバッグ情報を出力
    testLogger.info(`Test env vars: MCP_OAUTH_ENABLED=${process.env.MCP_OAUTH_ENABLED}, NODE_ENV=${process.env.NODE_ENV}`);
  });

  test('MCP health endpoint returns 200', async ({ page }) => {
    const baseURL = getBaseURL(page);
    const response = await page.request.get(`${baseURL}/mcp/health`);
    expect(response.status()).toBe(200);
    
    const healthData = await response.json();
    expect(healthData).toHaveProperty('status');
  });

  test('MCP info endpoint returns server information', async ({ page }) => {
    const baseURL = getBaseURL(page);
    const response = await page.request.get(`${baseURL}/mcp/info`);
    expect(response.status()).toBe(200);
    
    const info = await response.json();
    expect(info).toHaveProperty('name');
    expect(info).toHaveProperty('version');
    expect(info.name).toBe('authlete-study-session-mcp-server');
  });

  test('MCP tools endpoint returns available tools', async ({ page }) => {
    const baseURL = getBaseURL(page);
    
    const toolsRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: {}
    };

    const response = await page.request.post(`${baseURL}/mcp`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify(toolsRequest)
    });

    expect(response.status()).toBe(200);
    
    const text = await response.text();
    const result = parseSSEResponse(text);
    expect(result).toHaveProperty('result');
    expect(result.result).toHaveProperty('tools');
    expect(result.result.tools).toBeInstanceOf(Array);
    expect(result.result.tools.length).toBeGreaterThan(0);

    // 期待するツールが含まれているか確認
    const toolNames = result.result.tools.map((tool: any) => tool.name);
    expect(toolNames).toContain('list_tickets');
    expect(toolNames).toContain('search_tickets');
    expect(toolNames).toContain('reserve_ticket');
    expect(toolNames).toContain('cancel_reservation');
    expect(toolNames).toContain('get_user_reservations');
  });

  test('list_tickets tool returns ticket data', async ({ page }) => {
    const baseURL = getBaseURL(page);
    
    const toolCallRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'list_tickets',
        arguments: {
          limit: 5
        }
      }
    };

    const response = await page.request.post(`${baseURL}/mcp`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify(toolCallRequest)
    });

    expect(response.status()).toBe(200);
    
    const text = await response.text();
    const result = parseSSEResponse(text);
    expect(result).toHaveProperty('result');
    expect(result.result).toHaveProperty('content');
    expect(result.result.content).toBeInstanceOf(Array);
    expect(result.result.content[0]).toHaveProperty('text');
    expect(result.result.content[0].text).toContain('利用可能なチケット');
  });

  test('search_tickets tool with filters returns filtered results', async ({ page }) => {
    const baseURL = getBaseURL(page);
    
    const toolCallRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search_tickets',
        arguments: {
          max_price: 5000,
          min_available_seats: 1
        }
      }
    };

    const response = await page.request.post(`${baseURL}/mcp`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify(toolCallRequest)
    });

    expect(response.status()).toBe(200);
    
    const text = await response.text();
    const result = parseSSEResponse(text);
    expect(result).toHaveProperty('result');
    expect(result.result).toHaveProperty('content');
    expect(result.result.content).toBeInstanceOf(Array);
    
    // 検索条件が含まれているか確認
    const responseText = result.result.content[0].text;
    expect(responseText).toContain('検索条件');
  });

  test('reserve_ticket tool without user context returns error', async ({ page }) => {
    const baseURL = getBaseURL(page);
    
    // OAuth が無効な場合は直接MCPエンドポイントにアクセス
    const isOAuthEnabled = process.env.MCP_OAUTH_ENABLED === 'true';
    
    const toolCallRequest = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'reserve_ticket',
        arguments: {
          ticket_id: 1,
          seats: 2
        }
      }
    };

    if (isOAuthEnabled) {
      // OAuth有効な場合はアクセストークンを取得して認証付きでテスト
      const accessToken = await getAccessToken(page);
      const response = await page.request.post(`${baseURL}/mcp`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        data: JSON.stringify(toolCallRequest)
      });

      expect(response.status()).toBe(200);
      
      const text = await response.text();
      const result = parseSSEResponse(text);
      expect(result).toHaveProperty('result');
      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain('Unauthorized');
    } else {
      // OAuth無効な場合は認証なしでアクセスして動作確認
      const response = await page.request.post(`${baseURL}/mcp`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        data: JSON.stringify(toolCallRequest)
      });

      expect(response.status()).toBe(200);
      
      const text = await response.text();
      const result = parseSSEResponse(text);
      expect(result).toHaveProperty('result');
      expect(result.result.isError).toBe(true);
      expect(result.result.content[0].text).toContain('Unauthorized');
    }
  });

  test('get_user_reservations tool without user context returns error', async ({ page }) => {
    const baseURL = getBaseURL(page);
    const toolCallRequest = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'get_user_reservations',
        arguments: {}
      }
    };

    const response = await page.request.post(`${baseURL}/mcp`, {
      data: JSON.stringify(toolCallRequest),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      }
    });

    expect(response.status()).toBe(200);
    
    const text = await response.text();
    const result = parseSSEResponse(text);
    expect(result).toHaveProperty('result');
    expect(result.result.isError).toBe(true);
    expect(result.result.content[0].text).toContain('Unauthorized');
  });

  test('invalid tool name returns error', async ({ page }) => {
    const baseURL = getBaseURL(page);
    const toolCallRequest = {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'invalid_tool',
        arguments: {}
      }
    };

    const response = await page.request.post(`${baseURL}/mcp`, {
      data: JSON.stringify(toolCallRequest),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      }
    });

    expect(response.status()).toBe(200);
    
    const text = await response.text();
    const result = parseSSEResponse(text);
    expect(result).toHaveProperty('result');
    expect(result.result.isError).toBe(true);
    expect(result.result.content[0].text).toContain('Unknown tool');
  });
});