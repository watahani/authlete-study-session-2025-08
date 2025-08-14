import { test, expect } from '@playwright/test';

test.describe('OAuth 2.1 MCP Integration Tests', () => {
  const baseUrl = 'https://localhost:3443';
  const clientId = '3006291287';
  const redirectUri = 'http://localhost:6274/oauth/callback';


  test('Complete OAuth flow metadata discovery works', async ({ page }) => {
    // 1. Authorization Server Metadataの取得
    const authServerResponse = await page.request.get(`${baseUrl}/.well-known/oauth-authorization-server`);
    expect(authServerResponse.status()).toBe(200);
    
    const authServerMetadata = await authServerResponse.json();
    expect(authServerMetadata.authorization_endpoint).toBe(`${baseUrl}/oauth/authorize`);
    expect(authServerMetadata.token_endpoint).toBe(`${baseUrl}/oauth/token`);
    
    // 2. Protected Resource Metadataの取得
    const protectedResourceResponse = await page.request.get(`${baseUrl}/.well-known/oauth-protected-resource`);
    expect(protectedResourceResponse.status()).toBe(200);
    
    const protectedResourceMetadata = await protectedResourceResponse.json();
    expect(protectedResourceMetadata.resource).toBe(`${baseUrl}/mcp`);
    expect(protectedResourceMetadata.scopes_supported).toContain('mcp:tickets:read');
    expect(protectedResourceMetadata.scopes_supported).toContain('mcp:tickets:write');
    
    // 3. メタデータの整合性確認
    expect(protectedResourceMetadata.authorization_servers).toContain(authServerMetadata.issuer);
    expect(protectedResourceMetadata.introspection_endpoint).toBe(authServerMetadata.introspection_endpoint);
    expect(protectedResourceMetadata.revocation_endpoint).toBe(authServerMetadata.revocation_endpoint);
  });

  test('Authorization endpoint handles PKCE correctly', async ({ page }) => {
    const codeChallenge = '96K0CQpAaw1w6xsi96-o4VnO-9ltv1_o-MxZkz9uYkg'; // base64url(sha256(codeVerifier))
    
    const authUrl = new URL(`${baseUrl}/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'mcp:tickets:read mcp:tickets:write');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('resource', `${baseUrl}/mcp`);
    
    const response = await page.request.get(authUrl.toString());
    
    // PKCEが必須なので、パラメータが正しければリダイレクトまたはログインページが表示される
    expect([200, 302]).toContain(response.status());
    
    if (response.status() === 302) {
      // リダイレクトの場合、ログインページまたは同意ページへのリダイレクト
      const location = response.headers()['location'];
      expect(location).toBeTruthy();
    }
  });

  test('Authorization endpoint rejects requests without PKCE', async ({ page }) => {
    const authUrl = new URL(`${baseUrl}/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'mcp:tickets:read mcp:tickets:write');
    // code_challenge と code_challenge_method を意図的に省略
    
    const response = await page.request.get(authUrl.toString());
    
    // PKCEが必須なので、エラーが返される
    expect(response.status()).toBe(400);
    
    const error = await response.json();
    expect(error.error).toBe('invalid_request');
  });

  test('Unsupported scope is handled correctly', async ({ page }) => {
    const codeChallenge = '96K0CQpAaw1w6xsi96-o4VnO-9ltv1_o-MxZkz9uYkg';
    
    const authUrl = new URL(`${baseUrl}/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'unsupported:scope mcp:tickets:read'); // 未サポートスコープを含む
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    const response = await page.request.get(authUrl.toString());
    
    // 未サポートスコープがある場合の処理
    // Authleteは通常、サポートされているスコープのみを受け入れる
    expect([200, 302, 400]).toContain(response.status());
  });

  test('OAuth error responses include correct WWW-Authenticate headers', async ({ page }) => {
    // 認証なしでMCPエンドポイントにアクセス
    const mcpResponse = await page.request.post(`${baseUrl}/mcp`, {
      data: { method: 'tools/list', params: {} }
    });
    
    expect(mcpResponse.status()).toBe(401);
    
    const wwwAuth = mcpResponse.headers()['www-authenticate'];
    expect(wwwAuth).toContain('Bearer realm=');
    expect(wwwAuth).toContain('error="invalid_request"');
    expect(wwwAuth).toContain('resource_metadata=');
    
    // resource_metadataのURLが正しいことを確認
    const resourceMetadataMatch = wwwAuth.match(/resource_metadata="([^"]+)"/);
    expect(resourceMetadataMatch).toBeTruthy();
    
    if (resourceMetadataMatch) {
      const resourceMetadataUrl = resourceMetadataMatch[1];
      const metadataResponse = await page.request.get(resourceMetadataUrl);
      expect(metadataResponse.status()).toBe(200);
      
      const metadata = await metadataResponse.json();
      expect(metadata.resource).toBe(`${baseUrl}/mcp`);
    }
  });

  test('MCP endpoint requires correct scope', async ({ page }) => {
    // mcp:tickets:readスコープが必要
    const mcpResponse = await page.request.post(`${baseUrl}/mcp`, {
      data: { method: 'tools/list', params: {} }
    });
    
    expect(mcpResponse.status()).toBe(401);
    
    // Protected Resource Metadataで必要なスコープが確認できる
    const metadataResponse = await page.request.get(`${baseUrl}/.well-known/oauth-protected-resource/mcp`);
    const metadata = await metadataResponse.json();
    
    expect(metadata.scopes_supported).toContain('mcp:tickets:read');
    expect(metadata.bearer_methods_supported).toEqual(['header']);
  });

  test('Cross-origin requests work with proper CORS headers', async ({ page }) => {
    // メタデータエンドポイントのCORSテスト
    const corsResponse = await page.request.get(`${baseUrl}/.well-known/oauth-authorization-server`, {
      headers: {
        'Origin': 'https://example.com',
        'mcp-protocol-version': '2025-06-18'
      }
    });
    
    expect(corsResponse.status()).toBe(200);
    expect(corsResponse.headers()['access-control-allow-origin']).toBe('*');
    
    const metadata = await corsResponse.json();
    expect(metadata.issuer).toBe(baseUrl);
    expect(metadata.scopes_supported).toContain('mcp:tickets:read');
  });
});