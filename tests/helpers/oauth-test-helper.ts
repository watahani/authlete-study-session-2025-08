/**
 * OAuth テスト用ヘルパークラス
 */

import { Page, expect } from '@playwright/test';
import { oauthLogger } from '../../src/utils/logger.js';

export interface AuthorizationDetailsOptions {
  authorizationDetails: 'scope-only' | 'custom';
  maxAmount?: number;
}

export class OAuthTestHelper {
  private createdClients: string[] = [];
  
  async setupTest(page: Page) {
    // ベース URL を設定
    const baseUrl = process.env.BASE_URL || 'https://localhost:3000';
    
    // ブラウザのコンソールエラーとリクエストエラーを追跡
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[BROWSER ERROR] ${msg.text()}`);
      }
    });
    
    page.on('requestfailed', request => {
      console.log(`[REQUEST FAILED] ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });

    // 認証用のユーザーでログイン
    await page.goto(`${baseUrl}/auth/login`);
    await page.fill('input[name="username"]', 'test_user');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    
    // ログイン確認
    await page.waitForURL('**/dashboard');
  }

  async performOAuthFlow(page: Page, options: AuthorizationDetailsOptions) {
    const baseUrl = process.env.BASE_URL || 'https://localhost:3000';
    
    // DCR でクライアントを作成
    const clientInfo = await this.createTestClient();
    
    // 認可エンドポイントに移動
    const authUrl = new URL(`${baseUrl}/oauth/authorize`);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', clientInfo.client_id);
    authUrl.searchParams.append('redirect_uri', 'https://localhost:3000/oauth/callback');
    authUrl.searchParams.append('scope', 'ticket:read ticket:write');
    authUrl.searchParams.append('resource', 'https://localhost:3000/mcp');
    
    await page.goto(authUrl.toString());
    
    // 認可画面での選択
    if (options.authorizationDetails === 'scope-only') {
      // 標準権限を選択
      await page.check('#scope-only');
    } else {
      // カスタム制限を選択
      await page.check('#custom-limits');
      
      if (options.maxAmount !== undefined) {
        await page.fill('#max-amount', options.maxAmount.toString());
      }
    }
    
    // 許可ボタンをクリック
    await page.click('button.approve');
    
    // コールバックページで認可コードを取得
    await page.waitForURL('**/oauth/callback*');
    const callbackUrl = new URL(page.url());
    const code = callbackUrl.searchParams.get('code');
    
    if (!code) {
      throw new Error('認可コードが取得できませんでした');
    }
    
    // アクセストークンを取得
    const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientInfo.client_id}:${clientInfo.client_secret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: 'https://localhost:3000/oauth/callback'
      }).toString()
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`トークン取得エラー: ${tokenResponse.status}`);
    }
    
    const tokenData = await tokenResponse.json();
    
    oauthLogger.debug('OAuth flow completed', {
      accessToken: !!tokenData.access_token,
      authorizationDetails: options.authorizationDetails
    });
    
    return {
      accessToken: tokenData.access_token,
      clientInfo: clientInfo
    };
  }

  async createTestClient() {
    const baseUrl = process.env.BASE_URL || 'https://localhost:3000';
    
    // テスト用のアクセストークンでDCRクライアントを作成
    const dcrResponse = await fetch(`${baseUrl}/oauth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DCR_ACCESS_TOKEN || 'test-dcr-token'}`
      },
      body: JSON.stringify({
        client_name: `Test Client ${Date.now()}`,
        grant_types: ['authorization_code'],
        response_types: ['code'],
        redirect_uris: ['https://localhost:3000/oauth/callback'],
        scope: 'ticket:read ticket:write'
      })
    });
    
    if (!dcrResponse.ok) {
      throw new Error(`DCRクライアント作成エラー: ${dcrResponse.status}`);
    }
    
    const clientData = await dcrResponse.json();
    this.createdClients.push(clientData.client_id);
    
    return clientData;
  }

  async callMCPEndpoint(accessToken: string, tool: string, args: any) {
    const baseUrl = process.env.BASE_URL || 'https://localhost:3000';
    
    const mcpRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: tool,
        arguments: args
      }
    };
    
    return await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(mcpRequest)
    });
  }

  async cleanup() {
    const baseUrl = process.env.BASE_URL || 'https://localhost:3000';
    
    // 作成したクライアントを削除
    for (const clientId of this.createdClients) {
      try {
        await fetch(`${baseUrl}/oauth/register/${clientId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${process.env.DCR_ACCESS_TOKEN || 'test-dcr-token'}`
          }
        });
      } catch (error) {
        oauthLogger.error('Failed to cleanup client', { clientId, error });
      }
    }
    
    this.createdClients = [];
  }
}