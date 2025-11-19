import { test, expect } from '@playwright/test';

test.describe('OAuth Authentication Middleware', () => {
  const baseUrl = 'https://localhost:3443';

  // Helper function to get a working client identifier for token/create API using clientIdAlias
  async function getWorkingClientIdentifier(page: any): Promise<string> {
    // Use the known working client identifier directly
    return 'confidential-test-client';
  }


  test('MCP endpoint requires OAuth authentication', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/mcp`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    });
    
    expect(response.status()).toBe(401);
    expect(response.headers()['www-authenticate']).toContain('Bearer realm=');
    expect(response.headers()['www-authenticate']).toContain('error="invalid_request"');
    expect(response.headers()['www-authenticate']).toContain('resource_metadata=');
    expect(response.headers()['www-authenticate']).toContain('scope="mcp:tickets:read"');
    
    const error = await response.json();
    expect(error.error).toBe('invalid_request');
    expect(error.error_description).toBe('Access token is required');
  });

  test('Invalid bearer token returns proper error', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/mcp`, {
      headers: {
        'Authorization': 'Bearer invalid_token_here',
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        method: 'tools/list',
        params: {}
      })
    });
    
    expect(response.status()).toBe(401);
    expect(response.headers()['www-authenticate']).toContain('Bearer realm=');
    expect(response.headers()['www-authenticate']).toContain('error="invalid_token"');
    expect(response.headers()['www-authenticate']).toContain('resource_metadata=');
    expect(response.headers()['www-authenticate']).toContain('scope="mcp:tickets:read"');
    
    const error = await response.json();
    expect(error.error).toBe('invalid_token');
  });

  test('Bearer token in query parameter is rejected (OAuth 2.1 compliance)', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/mcp?access_token=some_token`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    });
    
    // OAuth 2.1では、クエリパラメータでのトークン送信は許可されない
    expect(response.status()).toBe(401);
    expect(response.headers()['www-authenticate']).toContain('Bearer realm=');
    expect(response.headers()['www-authenticate']).toContain('error="invalid_request"');
    expect(response.headers()['www-authenticate']).toContain('scope="mcp:tickets:read"');
  });

  test('Bearer token in request body is rejected (OAuth 2.1 compliance)', async ({ page }) => {
    const response = await page.request.post(`${baseUrl}/mcp`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify({
        id: 1,
        access_token: 'some_token',
        method: 'tools/list',
        params: {}
      })
    });
    
    // OAuth 2.1では、リクエストボディでのトークン送信は許可されない
    expect(response.status()).toBe(401);
    expect(response.headers()['www-authenticate']).toContain('Bearer realm=');
    expect(response.headers()['www-authenticate']).toContain('error="invalid_request"');
    expect(response.headers()['www-authenticate']).toContain('scope="mcp:tickets:read"');
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
    const response = await page.request.post(`${baseUrl}/mcp`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      })
    });
    
    expect(response.status()).toBe(401);
    
    const wwwAuth = response.headers()['www-authenticate'];
    expect(wwwAuth).toContain(`resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/mcp"`);
    expect(wwwAuth).toContain(`realm="${baseUrl}"`);
    expect(wwwAuth).toContain('error="invalid_request"');
    expect(wwwAuth).toContain('error_description="Access token is required"');
    expect(wwwAuth).toContain('scope="mcp:tickets:read"');
  });

  test('Required scope validation works', async ({ page }) => {
    // Authlete Create Token APIで間違ったスコープのトークンを作成
    const serviceId = process.env.AUTHLETE_SERVICE_ID;
    const serviceAccessToken = process.env.AUTHLETE_SERVICE_ACCESS_TOKEN;
    const baseUrlAuthlete = process.env.AUTHLETE_BASE_URL;
    
    if (!serviceId || !serviceAccessToken || !baseUrlAuthlete) {
      throw new Error('Authlete credentials not configured for testing');
    }
    
    // クライアントIDを取得
    const clientIdentifier = await getWorkingClientIdentifier(page);
    
    // 間違ったスコープ（MCPに必要ないスコープ）でアクセストークンを作成
    const createTokenResponse = await page.request.post(`${baseUrlAuthlete}/api/${serviceId}/auth/token/create`, {
      headers: {
        'Authorization': `Bearer ${serviceAccessToken}`,
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        grantType: 'AUTHORIZATION_CODE',
        clientIdentifier: clientIdentifier, // クライアントID（エイリアス使用）
        clientIdAliasUsed: true,
        subject: '1', // 存在するテストユーザーID
        scopes: ['mcp:tickets:read'], // 不十分なスコープ（writeスコープがない）
        resources: [`${baseUrl}/mcp`] // リソースは正しく指定
      })
    });
    
    expect(createTokenResponse.status()).toBe(200);
    const tokenData = await createTokenResponse.json();
    
    if (tokenData.action !== 'OK') {
      throw new Error(`Token creation failed: ${tokenData.resultMessage}`);
    }
    
    expect(tokenData.action).toBe('OK');
    expect(tokenData.accessToken).toBeDefined();
    
    // 不十分なスコープのトークンでwriteスコープが必要なツールを呼び出し
    const response = await page.request.post(`${baseUrl}/mcp`, {
      headers: {
        'Authorization': `Bearer ${tokenData.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      data: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'reserve_ticket',
          arguments: {
            ticket_id: 1,
            seats: 2
          }
        }
      })
    });
    
    // 不十分なスコープの場合、MCPサーバーマネージャーがUnauthorizedを返す
    expect(response.status()).toBe(200);
    const responseText = await response.text();
    const result = JSON.parse(responseText.split('\n').find(line => line.startsWith('data:'))?.substring(5) || '{}');
    expect(result.result.isError).toBe(true);
    expect(result.result.content[0].text).toContain('Unauthorized');
    
    // 作成したトークンをクリーンアップ
    await page.request.delete(`${baseUrlAuthlete}/api/${serviceId}/auth/token/delete/${tokenData.accessToken}`, {
      headers: {
        'Authorization': `Bearer ${serviceAccessToken}`
      }
    });
  });

  test('Health check endpoint does not require OAuth', async ({ page }) => {
    // ヘルスチェックエンドポイントはOAuth認可不要
    const response = await page.request.get(`${baseUrl}/mcp/health`);
    
    // ヘルスチェックは認証不要で200を返すべき
    expect(response.status()).toBe(200);
  });

  test.describe('Access Token Resources Validation', () => {
    test('Token created without resources parameter should be rejected', async ({ page }) => {
      // Authlete Create Token APIでresourcesパラメータなしでトークンを作成
      const serviceId = process.env.AUTHLETE_SERVICE_ID;
      const serviceAccessToken = process.env.AUTHLETE_SERVICE_ACCESS_TOKEN;
      const baseUrlAuthlete = process.env.AUTHLETE_BASE_URL;
      
      if (!serviceId || !serviceAccessToken || !baseUrlAuthlete) {
        throw new Error('Authlete credentials not configured for testing');
      }
      
      // クライアントIDを取得
      const clientIdentifier = await getWorkingClientIdentifier(page);
      
      // resourcesパラメータなしでアクセストークンを作成
      const createTokenResponse = await page.request.post(`${baseUrlAuthlete}/api/${serviceId}/auth/token/create`, {
        headers: {
          'Authorization': `Bearer ${serviceAccessToken}`,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({
          grantType: 'AUTHORIZATION_CODE',
          clientIdentifier: clientIdentifier, // クライアントID（エイリアス使用）
          clientIdAliasUsed: true,
          subject: '1', // 存在するテストユーザーID
          scopes: ['mcp:tickets:read', 'mcp:tickets:write']
          // resourcesパラメータを意図的に省略
        })
      });
      
      expect(createTokenResponse.status()).toBe(200);
      const tokenData = await createTokenResponse.json();
      expect(tokenData.action).toBe('OK');
      expect(tokenData.accessToken).toBeDefined();
      
      // 作成したトークンでMCPサーバーにアクセス
      const mcpResponse = await page.request.post(`${baseUrl}/mcp`, {
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        data: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        })
      });
      
      // resourcesパラメータなしで作成されたトークンは401エラーになるべき
      expect(mcpResponse.status()).toBe(401);
      
      const wwwAuth = mcpResponse.headers()['www-authenticate'];
      expect(wwwAuth).toContain('error="invalid_token"');
      expect(wwwAuth).toContain('error_description="Access token does not include required resource"');
      
      const error = await mcpResponse.json();
      expect(error.error).toBe('invalid_token');
      expect(error.error_description).toBe('Access token does not include required resource');
      
      // 作成したトークンをクリーンアップ
      await page.request.delete(`${baseUrlAuthlete}/api/${serviceId}/auth/token/delete/${tokenData.accessToken}`, {
        headers: {
          'Authorization': `Bearer ${serviceAccessToken}`
        }
      });
    });

    test('Token created with correct resources parameter should pass validation', async ({ page }) => {
      const serviceId = process.env.AUTHLETE_SERVICE_ID;
      const serviceAccessToken = process.env.AUTHLETE_SERVICE_ACCESS_TOKEN;
      const baseUrlAuthlete = process.env.AUTHLETE_BASE_URL;
      
      if (!serviceId || !serviceAccessToken || !baseUrlAuthlete) {
        throw new Error('Authlete credentials not configured for testing');
      }
      
      // クライアントIDを取得
      const clientIdentifier = await getWorkingClientIdentifier(page);
      
      // resourcesパラメータ付きでアクセストークンを作成
      const createTokenResponse = await page.request.post(`${baseUrlAuthlete}/api/${serviceId}/auth/token/create`, {
        headers: {
          'Authorization': `Bearer ${serviceAccessToken}`,
          'Content-Type': 'application/json'
        },
        data: JSON.stringify({
          grantType: 'AUTHORIZATION_CODE',
          clientIdentifier: clientIdentifier, // クライアントID（エイリアス使用）
          clientIdAliasUsed: true,
          subject: '1', // 存在するテストユーザーID
          scopes: ['mcp:tickets:read', 'mcp:tickets:write'],
          resources: [`${baseUrl}/mcp`] // 正しいリソースを指定
        })
      });
      
      expect(createTokenResponse.status()).toBe(200);
      const tokenData = await createTokenResponse.json();
      expect(tokenData.action).toBe('OK');
      expect(tokenData.accessToken).toBeDefined();
      
      // 作成したトークンでMCPサーバーにアクセス
      const mcpResponse = await page.request.post(`${baseUrl}/mcp`, {
        headers: {
          'Authorization': `Bearer ${tokenData.accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream'
        },
        data: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {}
        })
      });
      
      // 正しいresourcesパラメータで作成されたトークンはリソース検証をパス
      expect(mcpResponse.status()).toBe(200);
      
      const mcpResponseText = await mcpResponse.text();
      expect(mcpResponseText).toContain('result');
      expect(mcpResponseText).toContain('tools');
      
      // 作成したトークンをクリーンアップ
      await page.request.delete(`${baseUrlAuthlete}/api/${serviceId}/auth/token/delete/${tokenData.accessToken}`, {
        headers: {
          'Authorization': `Bearer ${serviceAccessToken}`
        }
      });
    });
  });
});
