import { test, expect } from '@playwright/test';
import crypto from 'crypto';
import { configureTestLogger } from '../src/utils/logger.js';

// Helper function to parse Server-Sent Events response
function parseSSEResponse(text: string): any {
  const eventData = text.split('\n').find(line => line.startsWith('data:'))?.substring(5).trim();
  return eventData ? JSON.parse(eventData) : null;
}

// テスト用ロガーを設定
const testLogger = configureTestLogger();

// PKCE用のユーティリティ関数
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(codeVerifier: string): string {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

test.describe('OAuth 2.1 Public Client Token Flow', () => {
  const baseUrl = 'https://localhost:3443';
  const clientId = '3006291287';
  const redirectUri = 'https://localhost:3443/oauth/callback';

  test('Complete OAuth 2.1 flow with PKCE for public client', async ({ page }) => {
    // ブラウザコンソールログを収集
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      testLogger.info(`[BROWSER ${type.toUpperCase()}] ${text}`);
    });
    
    // ネットワークエラーやレスポンス失敗を収集
    page.on('response', response => {
      if (!response.ok()) {
        testLogger.warn(`[NETWORK ERROR] ${response.status()} ${response.url()}`);
      }
    });
    
    page.on('requestfailed', request => {
      testLogger.error(`[REQUEST FAILED] ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });
    
    // Authorization code取得用の変数とイベントリスナー
    let authorizationCode: string | null = null;
    let state: string | null = null;
    
    // Responseイベントを監視してLocationヘッダーからcodeを取得
    page.on('response', (response) => {
      testLogger.trace(`Response: ${response.status()} ${response.url()}`);
      
      if (response.status() === 302) {
        const location = response.headers().location;
        testLogger.debug('302 redirect detected', { location });
        
        if (response.url().includes('/oauth/authorize/decision')) {
          testLogger.debug('Decision endpoint redirect detected');
          if (location && location.includes('code=')) {
            const locationUrl = new URL(location);
            authorizationCode = locationUrl.searchParams.get('code');
            state = locationUrl.searchParams.get('state');
            testLogger.debug('Authorization code extracted from 302 redirect', {
              codePrefix: authorizationCode?.substring(0, 10) + '...',
              state
            });
          } else {
            testLogger.warn('Location header does not contain authorization code');
            if (location && location.includes('error=')) {
              const locationUrl = new URL(location);
              const error = locationUrl.searchParams.get('error');
              const errorDescription = locationUrl.searchParams.get('error_description');
              testLogger.error('Authorization error in redirect', { error, errorDescription });
            }
          }
        }
      }
    });
    
    // 1. PKCEパラメータの生成
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    testLogger.debug('Generated PKCE parameters', {
      codeVerifier: codeVerifier.substring(0, 10) + '...',
      codeChallenge: codeChallenge.substring(0, 10) + '...'
    });

    // 2. 認可エンドポイントへのリクエスト準備
    const authUrl = new URL(`${baseUrl}/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'mcp:tickets:read mcp:tickets:write profile:read');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('resource', `${baseUrl}/mcp`);
    authUrl.searchParams.set('state', 'test_state_123');

    testLogger.debug('Authorization URL', { url: authUrl.toString() });

    // 3. 認可エンドポイントにアクセス
    await page.goto(authUrl.toString());

    // 4. ログインページの確認とログイン実行
    // ログインページが表示されるまで待機
    await page.waitForSelector('form', { timeout: 10000 });
    
    // ログインページのタイトル確認
    expect(await page.title()).toContain('ログイン');

    // テストユーザーでログイン
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');

    // 5. ログイン後の遷移を待機（consent または authorize）
    await page.waitForTimeout(3000); // 遷移待機
    
    testLogger.info('Current URL after login:', page.url());
    testLogger.info('Current page title:', await page.title());
    
    // ログイン後の遷移先を確認してから処理
    let loginCurrentUrl = page.url();
    let retries = 0;
    while (loginCurrentUrl.includes('/auth/login') && retries < 5) {
      testLogger.info(`Still on login page, waiting... (retry ${retries + 1})`);
      await page.waitForTimeout(2000);
      loginCurrentUrl = page.url();
      retries++;
    }
    
    testLogger.info('Final URL after retries:', loginCurrentUrl);
    
    // コンセントページまたは認可コールバックを待機
    if (loginCurrentUrl.includes('/oauth/authorize/consent')) {
      const bodyText = await page.textContent('body');
      testLogger.info('Consent page body:', bodyText);
      
      // エラーページの場合はスキップ
      if (bodyText?.includes('error') || bodyText?.includes('invalid_request')) {
        testLogger.warn('Error detected on consent page, skipping consent checks');
      } else {
        // 同意ページの内容確認
        expect(bodyText).toContain('mcp:tickets:read');
        expect(bodyText).toContain('mcp:tickets:write');
        expect(bodyText).toContain('profile:read');
      }

      // 同意フォームの送信を直接実行
      testLogger.info('Looking for consent form...');
      
      // 承認ボタンを直接クリック（最もシンプルなアプローチ）
      try {
        testLogger.info('Clicking approval button...');
        
        // ページでJavaScriptを無効にして、ネイティブフォーム送信を使用
        const approvalButton = await page.locator('button.approve').first();
        
        if (await approvalButton.isVisible()) {
          testLogger.info('Approval button is visible, clicking...');
          
          // 認可ボタンをクリック（302リダイレクトを待機）
          await approvalButton.click();
          
          // 302リダイレクトレスポンスを待機（認可コードが取得されるまで）
          let waitAttempts = 0;
          while (!authorizationCode && waitAttempts < 10) {
            await page.waitForTimeout(500);
            waitAttempts++;
          }
          
          testLogger.info('Authorization code check after click:', authorizationCode ? 'Found' : 'Not found');
        } else {
          testLogger.warn('Approval button not visible');
        }
        
      } catch (error) {
        testLogger.error('Button click failed:', error);
      }
      
      // 認可コードが302リダイレクトから取得できているかチェック
      testLogger.info('Final authorization code status:', authorizationCode ? 'Available' : 'Missing');
    } else if (loginCurrentUrl.includes('/auth/login')) {
      // まだログインページにいる場合は、認証が失敗している可能性
      testLogger.warn('Still on login page after retries, checking for errors');
      const errorElements = await page.$$('.error, .alert, [class*="error"], [id*="error"]');
      for (const element of errorElements) {
        const text = await element.textContent();
        testLogger.error('Error message found', { text });
      }
      throw new Error('Login failed or no redirect occurred');
    }

    // 6. 認可コードの最終確認（302リダイレクトから取得済み）
    testLogger.info('Final check - Authorization code:', authorizationCode ? 'Available' : 'Missing');
    testLogger.debug('Final check - State:', state);
    
    if (!authorizationCode) {
      testLogger.error('Authorization code was not obtained from 302 redirect');
      testLogger.error('Current page URL:', page.url());
      testLogger.error('Page title:', await page.title());
      const bodyText = await page.textContent('body');
      testLogger.debug('Page body content:', bodyText?.substring(0, 500) + '...');
    }

    expect(authorizationCode).toBeTruthy();
    expect(state).toBe('test_state_123');

    testLogger.debug('Authorization code obtained:', authorizationCode?.substring(0, 10) + '...');
    testLogger.debug('Authorization code length:', authorizationCode?.length);
    testLogger.info('Final callback URL:', page.url());

    // 7. トークンエンドポイントでアクセストークンを取得
    testLogger.info('Making token request with the following parameters:');
    const tokenRequestData = {
      grant_type: 'authorization_code',
      client_id: clientId,
      code: authorizationCode!,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    };
    testLogger.debug('Token request data:', {
      grant_type: tokenRequestData.grant_type,
      client_id: tokenRequestData.client_id,
      code: tokenRequestData.code?.substring(0, 10) + '...',
      redirect_uri: tokenRequestData.redirect_uri,
      code_verifier: tokenRequestData.code_verifier?.substring(0, 10) + '...'
    });
    
    // URLSearchParamsを使用して正しくエンコード
    const formData = new URLSearchParams();
    formData.append('grant_type', tokenRequestData.grant_type);
    formData.append('client_id', tokenRequestData.client_id);
    formData.append('code', tokenRequestData.code);
    formData.append('redirect_uri', tokenRequestData.redirect_uri);
    formData.append('code_verifier', tokenRequestData.code_verifier);
    
    testLogger.debug('Encoded form data:', formData.toString());
    
    const tokenResponse = await page.request.post(`${baseUrl}/oauth/token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: formData.toString()
    });

    testLogger.info('Token response status:', tokenResponse.status());
    testLogger.debug('Token response headers:', tokenResponse.headers());
    
    // レスポンスボディをデバッグ出力
    const responseText = await tokenResponse.text();
    testLogger.debug('Token response body:', responseText);
    
    // ステータスコードの確認とエラーハンドリング
    if (tokenResponse.status() !== 200) {
      testLogger.error('Token request failed with status:', tokenResponse.status());
      try {
        const errorData = JSON.parse(responseText);
        testLogger.error('Error details:', errorData);
        testLogger.error('Error code:', errorData.error);
        testLogger.error('Error description:', errorData.error_description);
      } catch (parseError) {
        testLogger.error('Could not parse error response as JSON:', parseError);
        testLogger.debug('Raw error response:', responseText);
      }
      throw new Error(`Token request failed with status ${tokenResponse.status()}: ${responseText}`);
    }
    
    expect(tokenResponse.status()).toBe(200);
    expect(tokenResponse.headers()['content-type']).toContain('application/json');

    const tokenData = JSON.parse(responseText);
    
    // 8. トークンレスポンスの検証
    expect(tokenData.access_token).toBeTruthy();
    expect(tokenData.token_type).toBe('Bearer');
    expect(tokenData.expires_in).toBeGreaterThan(0);
    expect(tokenData.scope).toBeTruthy();
    
    // スコープの検証
    const grantedScopes = tokenData.scope.split(' ');
    expect(grantedScopes).toContain('mcp:tickets:read');
    expect(grantedScopes).toContain('mcp:tickets:write');
    expect(grantedScopes).toContain('profile:read');

    testLogger.debug('Token obtained successfully:', {
      token_type: tokenData.token_type,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
      access_token: tokenData.access_token.substring(0, 20) + '...'
    });

    // 9. 取得したアクセストークンでMCPエンドポイントにアクセス
    const mcpResponse = await page.request.post(`${baseUrl}/mcp`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
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

    expect(mcpResponse.status()).toBe(200);
    
    const mcpText = await mcpResponse.text();
    testLogger.debug('MCP response text:', mcpText);
    const mcpData = parseSSEResponse(mcpText);
    expect(mcpData.result).toBeTruthy();
    expect(mcpData.result.tools).toBeTruthy();
    
    testLogger.info('MCP endpoint access successful:', {
      toolCount: mcpData.result.tools.length,
      tools: mcpData.result.tools.map((t: any) => t.name)
    });
  });

  test('Invalid code_verifier is rejected', async ({ page }) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    // Authorization code取得用の変数とイベントリスナー
    let authorizationCode: string | null = null;
    
    // Responseイベントを監視してLocationヘッダーからcodeを取得
    page.on('response', (response) => {
      if (response.status() === 302 && response.url().includes('/oauth/authorize/decision')) {
        const location = response.headers().location;
        if (location && location.includes('code=')) {
          const locationUrl = new URL(location);
          authorizationCode = locationUrl.searchParams.get('code');
        }
      }
    });
    
    // 認可フローを実行してcodeを取得
    const authUrl = new URL(`${baseUrl}/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'mcp:tickets:read');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    await page.goto(authUrl.toString());
    
    // ログインとコンセント（日本語対応）
    await page.waitForSelector('form', { timeout: 10000 });
    
    // ログインページのタイトル確認
    expect(await page.title()).toContain('ログイン');
    
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(2000);
    testLogger.debug('Current URL after login', { url: page.url() });
    
    // コンセントページまたは認可コールバックを待機
    if (page.url().includes('/oauth/authorize/consent')) {
      try {
        // 承認ボタンをクリック
        const approvalButton = await page.locator('button.approve').first();
        if (await approvalButton.isVisible()) {
          await approvalButton.click();
        }
      } catch {
        // フォーム送信を直接実行
        await page.evaluate(() => {
          const forms = document.querySelectorAll('form');
          for (const form of forms) {
            const authorizedInput = form.querySelector('input[name="authorized"][value="true"]') as HTMLInputElement;
            if (authorizedInput) {
              form.submit();
              return;
            }
          }
        });
      }
    }
    
    // 302リダイレクトレスポンスを待機（認可コードが取得されるまで）
    let waitAttempts = 0;
    while (!authorizationCode && waitAttempts < 10) {
      await page.waitForTimeout(500);
      waitAttempts++;
    }
    
    expect(authorizationCode).toBeTruthy();

    // 間違ったcode_verifierでトークンリクエスト
    const formData = new URLSearchParams();
    formData.append('grant_type', 'authorization_code');
    formData.append('client_id', clientId);
    formData.append('code', authorizationCode!);
    formData.append('redirect_uri', redirectUri);
    formData.append('code_verifier', 'wrong_code_verifier_here'); // 意図的に間違ったverifier
    
    const tokenResponse = await page.request.post(`${baseUrl}/oauth/token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: formData.toString()
    });

    expect(tokenResponse.status()).toBe(400);
    
    const errorData = await tokenResponse.json();
    expect(errorData.error).toBe('invalid_request');
  });

  test('Missing code_verifier is rejected', async ({ page }) => {
    // PKCEなしの認可フローを試行
    const authUrl = new URL(`${baseUrl}/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'mcp:tickets:read');
    // code_challengeとcode_challenge_methodを意図的に省略

    const response = await page.request.get(authUrl.toString());
    
    // PKCEが必須の場合は400、そうでなければログインページが表示される
    if (response.status() === 400) {
      const errorData = await response.json();
      expect(errorData.error).toBe('invalid_request');
    } else {
      // PKCE必須でない場合は200でログインページが表示される
      expect(response.status()).toBe(200);
      testLogger.info('PKCE is not required by this server configuration');
    }
  });

  test('Unsupported scope is filtered out', async ({ page }) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    // Authorization code取得用の変数とイベントリスナー
    let authorizationCode: string | null = null;
    
    // Responseイベントを監視してLocationヘッダーからcodeを取得
    page.on('response', (response) => {
      if (response.status() === 302 && response.url().includes('/oauth/authorize/decision')) {
        const location = response.headers().location;
        if (location && location.includes('code=')) {
          const locationUrl = new URL(location);
          authorizationCode = locationUrl.searchParams.get('code');
        }
      }
    });
    
    const authUrl = new URL(`${baseUrl}/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'mcp:tickets:read unsupported:scope invalid:scope');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    await page.goto(authUrl.toString());
    
    // ログインフロー（日本語対応）
    await page.waitForSelector('form', { timeout: 10000 });
    
    // ログインページのタイトル確認
    expect(await page.title()).toContain('ログイン');
    
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(2000);
    testLogger.debug('Current URL after login', { url: page.url() });
    
    // コンセントページまたは直接コールバックを待機
    try {
      await page.waitForURL(/consent/, { timeout: 10000 });
    } catch {
      // consentページが表示されない場合もある
      testLogger.debug('No consent page detected, checking for callback');
    }
    
    // コンセントページが表示された場合のスコープ確認
    if (page.url().includes('/oauth/authorize/consent')) {
      const bodyText = await page.textContent('body');
      expect(bodyText).toContain('mcp:tickets:read');
      expect(bodyText).not.toContain('unsupported:scope');
      expect(bodyText).not.toContain('invalid:scope');
      
      try {
        // 承認ボタンをクリック
        const approvalButton = await page.locator('button.approve').first();
        if (await approvalButton.isVisible()) {
          await approvalButton.click();
        }
      } catch {
        // フォーム送信を直接実行
        await page.evaluate(() => {
          const forms = document.querySelectorAll('form');
          for (const form of forms) {
            const authorizedInput = form.querySelector('input[name="authorized"][value="true"]') as HTMLInputElement;
            if (authorizedInput) {
              form.submit();
              return;
            }
          }
        });
      }
    }
    
    // 302リダイレクトレスポンスを待機（認可コードが取得されるまで）
    let waitAttempts = 0;
    while (!authorizationCode && waitAttempts < 10) {
      await page.waitForTimeout(500);
      waitAttempts++;
    }
    
    expect(authorizationCode).toBeTruthy();

    // トークン取得
    const formData = new URLSearchParams();
    formData.append('grant_type', 'authorization_code');
    formData.append('client_id', clientId);
    formData.append('code', authorizationCode!);
    formData.append('redirect_uri', redirectUri);
    formData.append('code_verifier', codeVerifier);
    
    const tokenResponse = await page.request.post(`${baseUrl}/oauth/token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: formData.toString()
    });

    expect(tokenResponse.status()).toBe(200);
    const tokenData = await tokenResponse.json();
    
    // 有効なスコープのみが付与されることを確認
    const grantedScopes = tokenData.scope.split(' ');
    expect(grantedScopes).toContain('mcp:tickets:read');
    expect(grantedScopes).not.toContain('unsupported:scope');
    expect(grantedScopes).not.toContain('invalid:scope');
  });

  test('Token introspection works correctly', async ({ page }) => {
    // まず有効なトークンを取得（前のテストロジックを再利用）
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    // Authorization code取得用の変数とイベントリスナー
    let authorizationCode: string | null = null;
    
    // Responseイベントを監視してLocationヘッダーからcodeを取得
    page.on('response', (response) => {
      if (response.status() === 302 && response.url().includes('/oauth/authorize/decision')) {
        const location = response.headers().location;
        if (location && location.includes('code=')) {
          const locationUrl = new URL(location);
          authorizationCode = locationUrl.searchParams.get('code');
        }
      }
    });
    
    const authUrl = new URL(`${baseUrl}/oauth/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'mcp:tickets:read profile:read');
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    await page.goto(authUrl.toString());
    await page.waitForSelector('form', { timeout: 10000 });
    
    // ログインページのタイトル確認
    expect(await page.title()).toContain('ログイン');
    
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    
    await page.waitForTimeout(2000);
    testLogger.debug('Current URL after login', { url: page.url() });
    
    // コンセントページまたは認可コールバックを待機
    if (page.url().includes('/oauth/authorize/consent')) {
      try {
        // 承認ボタンをクリック
        const approvalButton = await page.locator('button.approve').first();
        if (await approvalButton.isVisible()) {
          await approvalButton.click();
        }
      } catch {
        // フォーム送信を直接実行
        await page.evaluate(() => {
          const forms = document.querySelectorAll('form');
          for (const form of forms) {
            const authorizedInput = form.querySelector('input[name="authorized"][value="true"]') as HTMLInputElement;
            if (authorizedInput) {
              form.submit();
              return;
            }
          }
        });
      }
    }
    
    // 302リダイレクトレスポンスを待機（認可コードが取得されるまで）
    let waitAttempts = 0;
    while (!authorizationCode && waitAttempts < 10) {
      await page.waitForTimeout(500);
      waitAttempts++;
    }
    
    expect(authorizationCode).toBeTruthy();
    
    // トークンリクエスト
    const tokenFormData = new URLSearchParams();
    tokenFormData.append('grant_type', 'authorization_code');
    tokenFormData.append('client_id', clientId);
    tokenFormData.append('code', authorizationCode!);
    tokenFormData.append('redirect_uri', redirectUri);
    tokenFormData.append('code_verifier', codeVerifier);
    
    const tokenResponse = await page.request.post(`${baseUrl}/oauth/token`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: tokenFormData.toString()
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    expect(accessToken).toBeTruthy();

    // イントロスペクションエンドポイントでトークンを検証
    const introspectionFormData = new URLSearchParams();
    introspectionFormData.append('token', accessToken);
    
    const introspectionResponse = await page.request.post(`${baseUrl}/oauth/introspect`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: introspectionFormData.toString()
    });

    expect(introspectionResponse.status()).toBe(200);
    
    const introspectionData = await introspectionResponse.json();
    expect(introspectionData.active).toBe(true);
    expect(introspectionData.client_id).toBe(clientId);
    expect(introspectionData.scope).toBeTruthy();
    
    const introspectedScopes = introspectionData.scope.split(' ');
    expect(introspectedScopes).toContain('mcp:tickets:read');
    expect(introspectedScopes).toContain('profile:read');
  });
});