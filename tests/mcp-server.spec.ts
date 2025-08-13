import { test, expect } from '@playwright/test';

// Helper function to parse Server-Sent Events response
function parseSSEResponse(text: string): any {
  const eventData = text.split('\n').find(line => line.startsWith('data:'))?.substring(5).trim();
  return eventData ? JSON.parse(eventData) : null;
}

// Helper function to get base URL from test context
function getBaseURL(page: any): string {
  return page.context()._options.baseURL || 'http://localhost:3000';
}

test.describe('MCP Server Tests', () => {
  test.beforeEach(async () => {
    // MCPが有効な状態でテスト実行
    process.env.MCP_ENABLED = 'true';
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
      data: JSON.stringify(toolsRequest),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      }
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
    expect(result.result).toHaveProperty('content');
    expect(result.result.content).toBeInstanceOf(Array);
    
    // 検索条件が含まれているか確認
    const responseText = result.result.content[0].text;
    expect(responseText).toContain('検索条件');
  });

  test('reserve_ticket tool without user context returns error', async ({ page }) => {
    const baseURL = getBaseURL(page);
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
    expect(result.result.content[0].text).toContain('ユーザー認証が必要');
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
    expect(result.result.content[0].text).toContain('ユーザー認証が必要');
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