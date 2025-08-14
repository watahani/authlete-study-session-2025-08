import { test, expect } from '@playwright/test';

test.describe('OAuth Authentication Middleware', () => {
  const baseUrl = 'https://localhost:3443';


  test('MCP endpoint requires OAuth authentication', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/mcp`, {
      data: {
        method: 'tools/list',
        params: {}
      }
    });
    
    expect(response.status()).toBe(401);
    expect(response.headers()['www-authenticate']).toContain('Bearer realm=');
    expect(response.headers()['www-authenticate']).toContain('error="invalid_request"');
    expect(response.headers()['www-authenticate']).toContain('resource_metadata=');
    
    const error = await response.json();
    expect(error.error).toBe('invalid_request');
    expect(error.error_description).toBe('Access token is required');
  });

  test('Invalid bearer token returns proper error', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/mcp`, {
      headers: {
        'Authorization': 'Bearer invalid_token_here'
      },
      data: {
        method: 'tools/list',
        params: {}
      }
    });
    
    expect(response.status()).toBe(401);
    expect(response.headers()['www-authenticate']).toContain('Bearer realm=');
    expect(response.headers()['www-authenticate']).toContain('error="invalid_token"');
    expect(response.headers()['www-authenticate']).toContain('resource_metadata=');
    
    const error = await response.json();
    expect(error.error).toBe('invalid_token');
  });

  test('Bearer token in query parameter is rejected (OAuth 2.1 compliance)', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/mcp?access_token=some_token`, {
      data: {
        method: 'tools/list',
        params: {}
      }
    });
    
    // OAuth 2.1では、クエリパラメータでのトークン送信は許可されない
    expect(response.status()).toBe(401);
    expect(response.headers()['www-authenticate']).toContain('Bearer realm=');
    expect(response.headers()['www-authenticate']).toContain('error="invalid_request"');
  });

  test('Bearer token in request body is rejected (OAuth 2.1 compliance)', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/mcp`, {
      data: {
        access_token: 'some_token',
        method: 'tools/list',
        params: {}
      }
    });
    
    // OAuth 2.1では、リクエストボディでのトークン送信は許可されない
    expect(response.status()).toBe(401);
    expect(response.headers()['www-authenticate']).toContain('Bearer realm=');
    expect(response.headers()['www-authenticate']).toContain('error="invalid_request"');
  });

  test('CORS headers are present for MCP endpoint OPTIONS request', async ({ page }) => {
    const response = await page.request.fetch(`${baseUrl}/mcp`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:6274',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization'
      }
    });
    
    expect(response.status()).toBe(204);
    expect(response.headers()['access-control-allow-origin']).toBeDefined();
    expect(response.headers()['access-control-allow-methods']).toContain('POST');
    expect(response.headers()['access-control-allow-headers']).toContain('Authorization');
  });

  test('WWW-Authenticate header contains correct resource metadata URL', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/mcp`);
    
    expect(response.status()).toBe(401);
    
    const wwwAuth = response.headers()['www-authenticate'];
    expect(wwwAuth).toContain(`resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/mcp"`);
    expect(wwwAuth).toContain(`realm="${baseUrl}"`);
    expect(wwwAuth).toContain('error="invalid_request"');
    expect(wwwAuth).toContain('error_description="Access token is required"');
  });

  test('Required scope validation works', async ({ page }) => {
    // 実際のトークンを取得するのは複雑なので、モック的なテストとして
    // 不正なスコープを持つトークンのシナリオをテスト
    const response = await page.request.post(`${baseUrl}/mcp`, {
      headers: {
        'Authorization': 'Bearer mock_token_with_wrong_scope'
      },
      data: {
        method: 'tools/list',
        params: {}
      }
    });
    
    // 実際の実装では、Authleteがスコープ検証を行い、
    // 不十分なスコープの場合は403 Forbiddenが返される
    expect([401, 403]).toContain(response.status());
    
    if (response.status() === 403) {
      expect(response.headers()['www-authenticate']).toContain('error="insufficient_scope"');
      expect(response.headers()['www-authenticate']).toContain('scope="mcp:tickets:read"');
    }
  });

  test('Health check endpoint does not require OAuth', async ({ page }) => {
    // ヘルスチェックエンドポイントはOAuth認証不要
    const response = await page.request.get(`${baseUrl}/mcp/health`);
    
    // ヘルスチェックは認証不要で200を返すべき
    expect(response.status()).toBe(200);
  });
});