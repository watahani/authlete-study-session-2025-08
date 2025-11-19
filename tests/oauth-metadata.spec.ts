import { test, expect } from '@playwright/test';

test.describe('OAuth 2.0 Metadata Endpoints', () => {
  const baseUrl = 'https://localhost:3443';

  test('Authorization Server Metadata endpoint returns RFC 8414 compliant metadata', async ({ page }) => {
    
    const response = await page.request.get(`${baseUrl}/.well-known/oauth-authorization-server`);
    
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.headers()['access-control-allow-origin']).toBe('*');
    expect(response.headers()['cache-control']).toContain('max-age=3600');
    
    const metadata = await response.json();
    
    // RFC 8414 必須フィールドの確認
    expect(metadata.issuer).toBe(baseUrl);
    expect(metadata.authorization_endpoint).toBe(`${baseUrl}/oauth/authorize`);
    expect(metadata.token_endpoint).toBe(`${baseUrl}/oauth/token`);
    expect(metadata.jwks_uri).toBe(`${baseUrl}/.well-known/jwks.json`);
    expect(metadata.response_types_supported).toContain('code');
    expect(metadata.grant_types_supported).toContain('authorization_code');
    expect(metadata.subject_types_supported).toContain('public');
    
    // MCPスコープの確認
    expect(metadata.scopes_supported).toContain('mcp:tickets:read');
    expect(metadata.scopes_supported).toContain('mcp:tickets:write');
    expect(metadata.scopes_supported).toContain('profile:read');
  });

  test('Protected Resource Metadata endpoint returns RFC 8414 compliant metadata', async ({ page }) => {
    
    const response = await page.request.get(`${baseUrl}/.well-known/oauth-protected-resource`);
    
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.headers()['cache-control']).toContain('max-age=3600');
    
    const metadata = await response.json();
    
    // RFC 8414 Protected Resource Metadata必須フィールド
    expect(metadata.resource).toBe(`${baseUrl}/mcp`);
    expect(metadata.authorization_servers).toContain(baseUrl);
    
    // MCPスコープの確認
    expect(metadata.scopes_supported).toContain('mcp:tickets:read');
    expect(metadata.scopes_supported).toContain('mcp:tickets:write');
    
    // OAuth 2.1準拠のBearer token方式
    expect(metadata.bearer_methods_supported).toEqual(['header']);

    // リソースのドキュメントとポリシーURI
    expect(metadata.resource_documentation).toBe(`${baseUrl}/docs/mcp`);
    expect(metadata.resource_policy_uri).toBe(`${baseUrl}/policy/mcp`);

    // authorization_detailsのタイプ
    expect(metadata.authorization_details_types_supported).toContain('ticket-reservation');
  });

  test('MCP-specific Protected Resource Metadata endpoint works', async ({ page }) => {
    
    const response = await page.request.get(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    
    expect(response.status()).toBe(200);
    
    const metadata = await response.json();
    expect(metadata.resource).toBe(`${baseUrl}/mcp`);
    expect(metadata.authorization_servers).toContain(baseUrl);
    expect(metadata.scopes_supported).toContain('mcp:tickets:read');
    expect(metadata.authorization_details_types_supported).toContain('ticket-reservation');
  });

  test('CORS headers are present for Authorization Server metadata', async ({ page }) => {
    
    // プリフライトリクエストのテスト
    const preflightResponse = await page.request.fetch(`${baseUrl}/.well-known/oauth-authorization-server`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:6274',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'mcp-protocol-version'
      }
    });
    
    expect(preflightResponse.status()).toBe(204);
    expect(preflightResponse.headers()['access-control-allow-origin']).toBeDefined();
    expect(preflightResponse.headers()['access-control-allow-methods']).toContain('GET');
    expect(preflightResponse.headers()['access-control-allow-headers']).toContain('mcp-protocol-version');
  });

  test('Custom MCP protocol version header is supported', async ({ page }) => {
    
    const response = await page.request.get(`${baseUrl}/.well-known/oauth-authorization-server`, {
      headers: {
        'Origin': 'http://localhost:6274',
        'mcp-protocol-version': '2025-06-18'
      }
    });
    
    expect(response.status()).toBe(200);
    expect(response.headers()['access-control-allow-origin']).toBe('*');
    
    const metadata = await response.json();
    expect(metadata.issuer).toBe(baseUrl);
  });
});
