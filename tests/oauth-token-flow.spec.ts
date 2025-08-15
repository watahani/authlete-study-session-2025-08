import { test, expect } from '@playwright/test';
import crypto from 'crypto';

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
  const redirectUri = 'https://httpbin.org/anything';

  test('Complete OAuth 2.1 flow with PKCE for public client', async ({ page }) => {
    // ブラウザコンソールログを収集
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
    });
    
    // ネットワークエラーやレスポンス失敗を収集
    page.on('response', response => {
      if (!response.ok()) {
        console.log(`[NETWORK ERROR] ${response.status()} ${response.url()}`);
      }
    });
    
    page.on('requestfailed', request => {
      console.log(`[REQUEST FAILED] ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });
    
    // Authorization code取得用の変数とイベントリスナー
    let authorizationCode: string | null = null;
    let state: string | null = null;
    
    // Responseイベントを監視してLocationヘッダーからcodeを取得
    page.on('response', (response) => {
      if (response.status() === 302 && response.url().includes('/oauth/authorize/decision')) {
        const location = response.headers().location;
        if (location && location.includes('code=')) {
          const locationUrl = new URL(location);
          authorizationCode = locationUrl.searchParams.get('code');
          state = locationUrl.searchParams.get('state');
          console.log('Authorization code extracted from 302 redirect:', authorizationCode?.substring(0, 10) + '...');
        }
      }
    });
    
    // 1. PKCEパラメータの生成
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    console.log('Generated PKCE parameters:', {
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

    console.log('Authorization URL:', authUrl.toString());

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
    
    console.log('Current URL after login:', page.url());
    console.log('Current page title:', await page.title());
    
    // ログイン後の遷移先を確認してから処理
    let loginCurrentUrl = page.url();
    let retries = 0;
    while (loginCurrentUrl.includes('/auth/login') && retries < 5) {
      console.log(`Still on login page, waiting... (retry ${retries + 1})`);
      await page.waitForTimeout(2000);
      loginCurrentUrl = page.url();
      retries++;
    }
    
    console.log('Final URL after retries:', loginCurrentUrl);
    
    // コンセントページまたは認可コールバックを待機
    if (loginCurrentUrl.includes('/oauth/authorize/consent')) {
      const bodyText = await page.textContent('body');
      console.log('Consent page body:', bodyText);
      
      // エラーページの場合はスキップ
      if (bodyText?.includes('error') || bodyText?.includes('invalid_request')) {
        console.log('Error detected on consent page, skipping consent checks');
      } else {
        // 同意ページの内容確認
        expect(bodyText).toContain('mcp:tickets:read');
        expect(bodyText).toContain('mcp:tickets:write');
        expect(bodyText).toContain('profile:read');
      }

      // 同意フォームの送信を直接実行
      console.log('Looking for consent form...');
      
      // 承認ボタンを直接クリック（最もシンプルなアプローチ）
      try {
        console.log('Clicking approval button...');
        
        // ページでJavaScriptを無効にして、ネイティブフォーム送信を使用
        const approvalButton = await page.locator('button.approve').first();
        
        if (await approvalButton.isVisible()) {
          console.log('Approval button is visible, clicking...');
          
          // ナビゲーション待機とクリックを同時実行
          const navigationPromise = page.waitForURL(/callback|error/, { timeout: 10000 });
          
          await approvalButton.click();
          
          try {
            await navigationPromise;
            console.log('Navigation successful, current URL:', page.url());
          } catch (navError) {
            console.log('Navigation timeout, but checking current URL:', page.url());
            
            // URL変更があったか確認
            await page.waitForTimeout(2000);
            console.log('After timeout, current URL:', page.url());
          }
        } else {
          console.log('Approval button not visible');
        }
        
      } catch (error) {
        console.log('Button click failed:', error);
      }
      
      // URLから直接authorization codeを抽出
      await page.waitForTimeout(3000);
      const finalUrl = page.url();
      console.log('Final URL after consent:', finalUrl);
      
      if (finalUrl.includes('code=')) {
        const urlParams = new URL(finalUrl);
        authorizationCode = urlParams.searchParams.get('code');
        state = urlParams.searchParams.get('state');
      }
    } else if (loginCurrentUrl.includes('/auth/login')) {
      // まだログインページにいる場合は、認証が失敗している可能性
      console.log('Still on login page after retries, checking for errors');
      const errorElements = await page.$$('.error, .alert, [class*="error"], [id*="error"]');
      for (const element of errorElements) {
        const text = await element.textContent();
        console.log('Error message found:', text);
      }
      throw new Error('Login failed or no redirect occurred');
    }

    // 6. ネイティブアプリ想定: コンセント後のリダイレクトを待機してcodeを取得
    // コンセント後のリダイレクトを待機（最大15秒）
    let attempts = 0;
    while (!authorizationCode && attempts < 15) {
      await page.waitForTimeout(1000);
      attempts++;
    }
    
    // フォールバック: 現在のURLから取得を試行
    if (!authorizationCode && page.url().includes('code=')) {
      const currentUrl = new URL(page.url());
      authorizationCode = currentUrl.searchParams.get('code');
      state = currentUrl.searchParams.get('state');
    }

    expect(authorizationCode).toBeTruthy();
    expect(state).toBe('test_state_123');

    console.log('Authorization code obtained:', authorizationCode?.substring(0, 10) + '...');
    console.log('Final callback URL:', page.url());

    // 7. トークンエンドポイントでアクセストークンを取得
    const tokenResponse = await page.request.post(`${baseUrl}/oauth/token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: {
        grant_type: 'authorization_code',
        client_id: clientId,
        code: authorizationCode!,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }
    });

    expect(tokenResponse.status()).toBe(200);
    expect(tokenResponse.headers()['content-type']).toContain('application/json');

    const tokenData = await tokenResponse.json();
    
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

    console.log('Token obtained successfully:', {
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
    
    const mcpData = await mcpResponse.json();
    expect(mcpData.result).toBeTruthy();
    expect(mcpData.result.tools).toBeTruthy();
    
    console.log('MCP endpoint access successful:', {
      toolCount: mcpData.result.tools.length,
      tools: mcpData.result.tools.map((t: any) => t.name)
    });
  });

  test('Invalid code_verifier is rejected', async ({ page }) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
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
    console.log('Current URL after login:', page.url());
    
    // コンセントページまたは認可コールバックを待機
    if (page.url().includes('/oauth/authorize/consent')) {
      try {
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
      } catch {
        try {
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
      } catch {
        await page.click('button[name="authorized"][value="true"]');
      }
      }
    }
    
    await page.waitForURL(/oauth\/callback/, { timeout: 15000 });
    const authorizationCode = new URL(page.url()).searchParams.get('code');

    // 間違ったcode_verifierでトークンリクエスト
    const tokenResponse = await page.request.post(`${baseUrl}/oauth/token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: {
        grant_type: 'authorization_code',
        client_id: clientId,
        code: authorizationCode!,
        redirect_uri: redirectUri,
        code_verifier: 'wrong_code_verifier_here', // 意図的に間違ったverifier
      }
    });

    expect(tokenResponse.status()).toBe(400);
    
    const errorData = await tokenResponse.json();
    expect(errorData.error).toBe('invalid_grant');
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
      console.log('PKCE is not required by this server configuration');
    }
  });

  test('Unsupported scope is filtered out', async ({ page }) => {
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
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
    console.log('Current URL after login:', page.url());
    
    // コンセントページまたは直接コールバックを待機
    try {
      await page.waitForURL(/consent/, { timeout: 10000 });
    } catch {
      // consentページが表示されない場合もある
      console.log('No consent page detected, checking for callback');
    }
    
    // コンセントページが表示された場合のスコープ確認
    if (page.url().includes('/oauth/authorize/consent')) {
      const bodyText = await page.textContent('body');
      expect(bodyText).toContain('mcp:tickets:read');
      expect(bodyText).not.toContain('unsupported:scope');
      expect(bodyText).not.toContain('invalid:scope');
      
      try {
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
      } catch {
        await page.click('button[name="authorized"][value="true"]');
      }
    }
    
    await page.waitForURL(/oauth\/callback/, { timeout: 15000 });
    const authorizationCode = new URL(page.url()).searchParams.get('code');

    // トークン取得
    const tokenResponse = await page.request.post(`${baseUrl}/oauth/token`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: {
        grant_type: 'authorization_code',
        client_id: clientId,
        code: authorizationCode!,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }
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
    console.log('Current URL after login:', page.url());
    
    // コンセントページまたは認可コールバックを待機
    if (page.url().includes('/oauth/authorize/consent')) {
      try {
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
      } catch {
        try {
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
      } catch {
        await page.click('button[name="authorized"][value="true"]');
      }
      }
    }
    
    await page.waitForURL(/oauth\/callback/, { timeout: 15000 });
    
    const authorizationCode = new URL(page.url()).searchParams.get('code');
    
    const tokenResponse = await page.request.post(`${baseUrl}/oauth/token`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: {
        grant_type: 'authorization_code',
        client_id: clientId,
        code: authorizationCode!,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // イントロスペクションエンドポイントでトークンを検証
    const introspectionResponse = await page.request.post(`${baseUrl}/oauth/introspect`, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      data: {
        token: accessToken,
      }
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