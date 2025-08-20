/**
 * OAuth テスト用統合ヘルパークラス
 * 既存のOAuth token flowテストから処理を統合
 */

import { Page } from '@playwright/test';
import crypto from 'crypto';
import { oauthLogger } from '../../src/utils/logger.js';

// Helper function to parse Server-Sent Events response
function parseSSEResponse(text: string): any {
  const eventData = text.split('\n').find(line => line.startsWith('data:'))?.substring(5).trim();
  return eventData ? JSON.parse(eventData) : null;
}

export interface AuthorizationCodeFlowOptions {
  scope: string;
  clientId: string;
  authorizationDetails?: 'scope-only' | 'custom';
  maxAmount?: number;
  clientSecret?: string;
  clientType?: 'PUBLIC' | 'CONFIDENTIAL';
  tokenAuthMethod?: 'CLIENT_SECRET_BASIC' | 'CLIENT_SECRET_POST' | 'NONE';
}

export interface OAuthFlowResult {
  accessToken: string;
  clientInfo: { client_id: string };
  codeVerifier: string;
  refreshToken?: string;
}

// Test Client Constants
export const TEST_CLIENTS = {
  MCP_PUBLIC: process.env.MCP_PUBLIC_CLIENT_ID || 'mcp-public-client', // authorization details対応済み, Public Client
  CONFIDENTIAL: process.env.CONFIDENTIAL_CLIENT_ID || 'confidential-test-client',
  CONFIDENTIAL_SECRET: process.env.CONFIDENTIAL_CLIENT_SECRET || 'BskQUERTo76KUYy4gKnyKDjkkph-4wjYF-4Bw34cfYAGRS6eJ4k9YfFbFjSoOHBI9DwjgyTngDlJsf6s71BOYg'
} as const;

export class OAuthTestHelper {
  private createdClients: string[] = [];
  
  private readonly baseUrl = process.env.BASE_URL || 'https://localhost:3443';
  private readonly redirectUri = `${this.baseUrl}/oauth/callback`;

  async setupTest(page: Page) {
    // ブラウザのコンソールエラーとリクエストエラーを追跡
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[BROWSER ERROR] ${msg.text()}`);
      }
    });
    
    page.on('requestfailed', request => {
      console.log(`[REQUEST FAILED] ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });

    // 認証用のユーザーでログイン (既存のテストユーザーを使用)
    await page.goto(`${this.baseUrl}/auth/login`);
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');
    
    // フォーム送信とJSONレスポンスの確認
    const [response] = await Promise.all([
      page.waitForResponse(resp => resp.url().includes('/auth/login') && resp.request().method() === 'POST'),
      page.click('button[type="submit"]')
    ]);
    
    // ログイン成功を確認
    if (!response.ok()) {
      throw new Error(`ログインに失敗しました: ${response.status()}`);
    }
    
    const responseData = await response.json();
    if (!responseData.user) {
      throw new Error('ログインレスポンスにユーザー情報が含まれていません');
    }
    
    oauthLogger.debug('Login successful in test setup', { user: responseData.user });
  }

  async performAuthorizationCodeFlow(page: Page, options: AuthorizationCodeFlowOptions): Promise<OAuthFlowResult> {
    // クライアント設定の決定
    const clientId = options.clientId;
    const clientSecret = options.clientSecret;
    const tokenAuthMethod = options.tokenAuthMethod || 'CLIENT_SECRET_BASIC';
    const isConfidential = options.clientType === 'CONFIDENTIAL' || !!clientSecret;
    
    // PKCEパラメータを生成
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    
    // Authorization code取得用の変数とイベントリスナー
    let authorizationCode: string | null = null;
    let state: string | null = null;
    
    // Responseイベントを監視してLocationヘッダーからcodeを取得
    page.on('response', (response) => {
      if (response.status() === 302) {
        const location = response.headers().location;
        if (response.url().includes('/oauth/authorize/decision')) {
          if (location && location.includes('code=')) {
            const locationUrl = new URL(location);
            authorizationCode = locationUrl.searchParams.get('code');
            state = locationUrl.searchParams.get('state');
            oauthLogger.debug('Authorization code extracted from 302 redirect', {
              codePrefix: authorizationCode?.substring(0, 10) + '...',
              state
            });
          }
        }
      }
    });
    
    // 認可エンドポイントに移動
    const authUrl = new URL(`${this.baseUrl}/oauth/authorize`);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', this.redirectUri);
    authUrl.searchParams.append('scope', options.scope);
    // MCP関連スコープの場合のみresourceパラメータを追加
    if (options.scope.includes('mcp:')) {
      authUrl.searchParams.append('resource', `${this.baseUrl}/mcp`);
    }
    authUrl.searchParams.append('code_challenge', codeChallenge);
    authUrl.searchParams.append('code_challenge_method', 'S256');
    authUrl.searchParams.append('state', 'test_state_' + Date.now());
    
    await page.goto(authUrl.toString());
    
    // ログイン後の遷移を待機（既にログイン済みなのでconsentページに直接遷移）
    await page.waitForTimeout(3000);
    
    let currentUrl = page.url();
    let retries = 0;
    while (currentUrl.includes('/auth/login') && retries < 5) {
      oauthLogger.info(`Still on login page, waiting... (retry ${retries + 1})`);
      await page.waitForTimeout(2000);
      currentUrl = page.url();
      retries++;
    }
    
    // コンセントページでの処理
    if (currentUrl.includes('/oauth/authorize/consent')) {
      const bodyText = await page.textContent('body');
      oauthLogger.info('Consent page body:', bodyText);
      
      // Authorization Detailsが表示されているかチェック
      if (bodyText?.includes('詳細なアクセス権限設定') && options.authorizationDetails) {
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
      } else if (options.authorizationDetails) {
        oauthLogger.warn('Authorization Details UI not found on consent page');
      }
      
      // 承認ボタンをクリック
      try {
        const approvalButton = await page.locator('button.approve').first();
        if (await approvalButton.isVisible()) {
          await approvalButton.click();
          
          // 302リダイレクトレスポンスを待機（認可コードが取得されるまで）
          let waitAttempts = 0;
          while (!authorizationCode && waitAttempts < 10) {
            await page.waitForTimeout(500);
            waitAttempts++;
          }
        }
      } catch (error) {
        oauthLogger.error('Button click failed:', error);
      }
    }
    
    // 認可コードの最終確認
    if (!authorizationCode) {
      oauthLogger.error('Authorization code was not obtained');
      oauthLogger.error('Current page URL:', page.url());
      const bodyText = await page.textContent('body');
      oauthLogger.debug('Page body content:', bodyText?.substring(0, 500) + '...');
      throw new Error('認可コードが取得できませんでした');
    }
    
    // アクセストークンを取得
    const tokenRequestData = new URLSearchParams({
      grant_type: 'authorization_code',
      code: authorizationCode,
      redirect_uri: this.redirectUri,
      code_verifier: codeVerifier
    });

    let tokenHeaders: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    if (isConfidential && clientSecret) {
      // Confidential Client: 認証方法に応じて処理を分岐
      if (tokenAuthMethod === 'CLIENT_SECRET_BASIC') {
        // Basic認証を使用
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        tokenHeaders['Authorization'] = `Basic ${credentials}`;
      } else if (tokenAuthMethod === 'CLIENT_SECRET_POST') {
        // POST bodyに含める
        tokenRequestData.append('client_id', clientId);
        tokenRequestData.append('client_secret', clientSecret);
      } else {
        // NONE の場合はクライアントIDのみ
        tokenRequestData.append('client_id', clientId);
      }
    } else {
      // Public Client
      tokenRequestData.append('client_id', clientId);
    }

    const tokenResponse = await page.request.post(`${this.baseUrl}/oauth/token`, {
      headers: tokenHeaders,
      data: tokenRequestData.toString()
    });
    
    if (!tokenResponse.ok()) {
      const errorText = await tokenResponse.text();
      throw new Error(`トークン取得エラー: ${tokenResponse.status()} - ${errorText}`);
    }
    
    const tokenData = await tokenResponse.json();
    
    oauthLogger.debug('Authorization code flow completed', {
      accessToken: !!tokenData.access_token,
      scope: options.scope,
      authorizationDetails: options.authorizationDetails
    });
    
    return {
      accessToken: tokenData.access_token,
      clientInfo: { client_id: clientId },
      codeVerifier: codeVerifier,
      refreshToken: tokenData.refresh_token
    };
  }

  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  private generateCodeChallenge(codeVerifier: string): string {
    return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  }

  async performRefreshTokenFlow(
    page: Page, 
    refreshToken: string, 
    clientId: string, 
    clientSecret?: string, 
    clientType?: 'PUBLIC' | 'CONFIDENTIAL',
    tokenAuthMethod?: 'CLIENT_SECRET_BASIC' | 'CLIENT_SECRET_POST' | 'NONE'
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    // クライアント設定の決定
    const authMethod = tokenAuthMethod || 'CLIENT_SECRET_BASIC';
    const isConfidential = clientType === 'CONFIDENTIAL' || !!clientSecret;

    const tokenRequestData = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });

    let tokenHeaders: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    if (isConfidential && clientSecret) {
      // Confidential Client: 認証方法に応じて処理を分岐
      if (authMethod === 'CLIENT_SECRET_BASIC') {
        // Basic認証を使用
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
        tokenHeaders['Authorization'] = `Basic ${credentials}`;
      } else if (authMethod === 'CLIENT_SECRET_POST') {
        // POST bodyに含める
        tokenRequestData.append('client_id', clientId);
        tokenRequestData.append('client_secret', clientSecret);
      } else {
        // NONE の場合はクライアントIDのみ
        tokenRequestData.append('client_id', clientId);
      }
    } else {
      // Public Client
      tokenRequestData.append('client_id', clientId);
    }

    const tokenResponse = await page.request.post(`${this.baseUrl}/oauth/token`, {
      headers: tokenHeaders,
      data: tokenRequestData.toString()
    });

    if (!tokenResponse.ok()) {
      const errorText = await tokenResponse.text();
      throw new Error(`リフレッシュトークンエラー: ${tokenResponse.status()} - ${errorText}`);
    }

    const tokenData = await tokenResponse.json();

    oauthLogger.debug('Refresh token flow completed', {
      accessToken: !!tokenData.access_token,
      refreshToken: !!tokenData.refresh_token
    });

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token
    };
  }

  async callMCPEndpoint(page: Page, accessToken: string, tool: string, args: any) {
    let mcpRequest: any;
    
    if (tool === 'tools/list') {
      // tools/listの場合は特別な形式
      mcpRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list',
        params: {}
      };
    } else {
      // 通常のツール呼び出し
      mcpRequest = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: tool,
          arguments: args
        }
      };
    }
    
    const response = await page.request.post(`${this.baseUrl}/mcp`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${accessToken}`
      },
      data: JSON.stringify(mcpRequest)
    });
    
    // MCPレスポンスはSSE形式なので、適切にパースして返す
    return {
      status: () => response.status(),
      json: async () => {
        const text = await response.text();
        return parseSSEResponse(text);
      }
    };
  }

  async cleanup() {
    // MCP Test Clientを使用するのでクリーンアップは不要
    // DCRで作成したクライアントがある場合のみクリーンアップ
    if (this.createdClients.length > 0) {
      for (const clientId of this.createdClients) {
        try {
          await fetch(`${this.baseUrl}/oauth/register/${clientId}`, {
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
}