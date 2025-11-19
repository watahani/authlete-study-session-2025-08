import { test, expect } from '@playwright/test';
import { configureTestLogger } from '../src/utils/logger.js';

// テスト用ロガーを設定
const testLogger = configureTestLogger();

/**
 * Dynamic Client Registration (DCR) のテスト
 * RFC 7591/7592 に基づく実装をテスト
 */

const BASE_URL = process.env.BASE_URL || 'https://localhost:3443';

test.describe('Dynamic Client Registration (DCR)', () => {
  test('should complete full DCR lifecycle (register → get → delete)', async ({ request }) => {
    // Step 1: Register a new client via DCR
    const clientMetadata = {
      client_name: 'DCR Test Client',
      client_uri: 'https://example.com',
      logo_uri: 'https://example.com/logo.png',
      tos_uri: 'https://example.com/tos',
      policy_uri: 'https://example.com/policy',
      redirect_uris: ['https://example.com/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      scope: 'openid profile email',
      token_endpoint_auth_method: 'client_secret_basic',
      application_type: 'web',
      contacts: ['admin@example.com']
    };

    const registrationResponse = await request.post(`${BASE_URL}/oauth/register`, {
      data: clientMetadata,
      headers: {
        'Content-Type': 'application/json'
      },
      ignoreHTTPSErrors: true
    });

    expect(registrationResponse.status()).toBe(201);
    
    const registrationData = await registrationResponse.json();
    
    // 基本的な応答フィールドの確認
    expect(registrationData).toHaveProperty('client_id');
    expect(registrationData).toHaveProperty('client_secret');
    expect(registrationData).toHaveProperty('registration_access_token');
    expect(registrationData).toHaveProperty('registration_client_uri');
    expect(registrationData).toHaveProperty('client_id_issued_at');
    
    // DCR識別情報の確認
    expect(registrationData.client_name).toBe('DCR Test Client');
    expect(registrationData.redirect_uris).toEqual(['https://example.com/callback']);
    expect(registrationData.grant_types).toContain('authorization_code');
    expect(registrationData.response_types).toContain('code');
    
    const registrationAccessToken = registrationData.registration_access_token;
    const clientId = registrationData.client_id;
    
    testLogger.info('Step 1 - DCR Registration successful:', {
      client_id: clientId,
      client_name: registrationData.client_name,
      hasRegistrationToken: !!registrationAccessToken
    });

    // Step 2: Retrieve client information via DCR
    const getResponse = await request.get(`${BASE_URL}/oauth/register/${clientId}`, {
      headers: {
        'Authorization': `Bearer ${registrationAccessToken}`
      },
      ignoreHTTPSErrors: true
    });

    expect(getResponse.status()).toBe(200);
    
    const getData = await getResponse.json();
    
    // クライアント情報の確認
    expect(getData.client_id).toBe(clientId);
    expect(getData.client_name).toBe('DCR Test Client');
    expect(getData.redirect_uris).toEqual(['https://example.com/callback']);
    
    testLogger.info('Step 2 - DCR Get successful:', {
      client_id: getData.client_id,
      client_name: getData.client_name
    });

    // Step 3: Update client information via DCR (現在スキップ - Authleteのバグにより一時的に無効)
    testLogger.info('Step 3 - DCR Update: スキップ (Authlete側のバグにより現在利用不可)');
    
    // TODO: Authleteの更新機能バグ修正後に有効化
    // const updatedMetadata = {
    //   client_name: "Updated DCR Test Client",
    //   default_max_age: 0,
    //   registration_client_uri: `${BASE_URL}/oauth/register/${clientId}`,
    //   client_id: clientId,
    //   token_endpoint_auth_method: "client_secret_basic",
    //   require_pushed_authorization_requests: false,
    //   backchannel_user_code_parameter: false,
    //   client_secret: clientSecret,
    //   tls_client_certificate_bound_access_tokens: false,
    //   id_token_signed_response_alg: "RS256",
    //   subject_type: "public",
    //   require_signed_request_object: false,
    //   client_uri: "https://updated.example.com",
    //   redirect_uris: ["https://updated.example.com/callback"]
    // };
    //
    // const updateResponse = await request.put(`${BASE_URL}/oauth/register/${clientId}`, {
    //   data: updatedMetadata,
    //   headers: {
    //     'Authorization': `Bearer ${registrationAccessToken}`,
    //     'Content-Type': 'application/json'
    //   },
    //   ignoreHTTPSErrors: true
    // });
    //
    // if (updateResponse.status() !== 200) {
    //   const errorText = await updateResponse.text();
    //   console.log(`DCR Update Error [${updateResponse.status()}]:`, errorText);
    // }
    // expect(updateResponse.status()).toBe(200);
    // 
    // const updateData = await updateResponse.json();
    // 
    // // 更新された情報の確認
    // expect(updateData.client_id).toBe(clientId);
    // expect(updateData.client_name).toBe('Updated DCR Test Client');
    // expect(updateData.client_uri).toBe('https://updated.example.com');
    // expect(updateData.redirect_uris).toEqual(['https://updated.example.com/callback']);
    // expect(updateData.token_endpoint_auth_method).toBe('client_secret_basic');
    // 
    // console.log('Step 3 - DCR Update successful:', {
    //   client_id: updateData.client_id,
    //   client_name: updateData.client_name,
    //   updated_client_uri: updateData.client_uri
    // });

    // Step 4: Delete client via DCR
    const deleteResponse = await request.delete(`${BASE_URL}/oauth/register/${clientId}`, {
      headers: {
        'Authorization': `Bearer ${registrationAccessToken}`
      },
      ignoreHTTPSErrors: true
    });

    expect(deleteResponse.status()).toBe(204);
    
    testLogger.info('Step 4 - DCR Delete successful:', {
      client_id: clientId
    });

    // Step 5: Verify deleted client cannot be accessed
    const accessDeletedResponse = await request.get(`${BASE_URL}/oauth/register/${clientId}`, {
      headers: {
        'Authorization': `Bearer ${registrationAccessToken}`
      },
      ignoreHTTPSErrors: true
    });

    // 削除されたクライアントへのアクセスは失敗すべき
    expect([400, 401, 404]).toContain(accessDeletedResponse.status());
    
    testLogger.info('Step 5 - Access to deleted client correctly failed');
  });

  test('should omit client_secret for public clients', async ({ request }) => {
    const clientMetadata = {
      client_name: 'DCR Public Client',
      redirect_uris: ['https://example.com/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      scope: 'mcp:tickets:read',
      token_endpoint_auth_method: 'none',
      application_type: 'web'
    };

    const registrationResponse = await request.post(`${BASE_URL}/oauth/register`, {
      data: clientMetadata,
      headers: {
        'Content-Type': 'application/json'
      },
      ignoreHTTPSErrors: true
    });

    expect(registrationResponse.status()).toBe(201);
    const responseData = await registrationResponse.json();

    expect(responseData.token_endpoint_auth_method).toBe('none');
    expect(responseData.client_secret).toBeUndefined();
    expect(responseData.registration_access_token).toBeDefined();

    const deleteResponse = await request.delete(`${BASE_URL}/oauth/register/${responseData.client_id}`, {
      headers: {
        'Authorization': `Bearer ${responseData.registration_access_token}`
      },
      ignoreHTTPSErrors: true
    });

    expect(deleteResponse.status()).toBe(204);
  });
});

test.describe('DCR Error Handling (Independent Tests)', () => {
  test('should fail DCR operations without proper authorization', async ({ request }) => {
    // まず実在するクライアントを作成
    const clientMetadata = {
      client_name: 'Test Client for Auth Check',
      redirect_uris: ['https://example.com/callback']
    };

    const createResponse = await request.post(`${BASE_URL}/oauth/register`, {
      data: clientMetadata,
      headers: {
        'Content-Type': 'application/json'
      },
      ignoreHTTPSErrors: true
    });

    expect(createResponse.status()).toBe(201);
    const createdClient = await createResponse.json();
    const testClientId = createdClient.client_id;
    
    // 無効なトークンでのGET（存在するクライアントID使用）
    const getResponse = await request.get(`${BASE_URL}/oauth/register/${testClientId}`, {
      headers: {
        'Authorization': 'Bearer invalid_token'
      },
      ignoreHTTPSErrors: true
    });
    expect([400, 401]).toContain(getResponse.status()); // BadRequestまたはUnauthorizedを許容
    
    // 無効なトークンでのPUT
    const putResponse = await request.put(`${BASE_URL}/oauth/register/${testClientId}`, {
      data: { client_name: 'Updated Name' },
      headers: {
        'Authorization': 'Bearer invalid_token',
        'Content-Type': 'application/json'
      },
      ignoreHTTPSErrors: true
    });
    expect([400, 401]).toContain(putResponse.status()); // BadRequestまたはUnauthorizedを許容
    
    // 無効なトークンでのDELETE
    const deleteResponse = await request.delete(`${BASE_URL}/oauth/register/${testClientId}`, {
      headers: {
        'Authorization': 'Bearer invalid_token'
      },
      ignoreHTTPSErrors: true
    });
    expect([400, 401]).toContain(deleteResponse.status()); // BadRequestまたはUnauthorizedを許容
    
    // 作成したテストクライアントをクリーンアップ（有効なトークンで削除）
    await request.delete(`${BASE_URL}/oauth/register/${testClientId}`, {
      headers: {
        'Authorization': `Bearer ${createdClient.registration_access_token}`
      },
      ignoreHTTPSErrors: true
    });
  });

  test('should fail DCR registration with wrong content type', async ({ request }) => {
    const clientMetadata = {
      client_name: 'Test Client',
      redirect_uris: ['https://example.com/callback']
    };

    const response = await request.post(`${BASE_URL}/oauth/register`, {
      data: clientMetadata,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded' // 不正なContent-Type
      },
      ignoreHTTPSErrors: true
    });

    expect(response.status()).toBe(400);
    
    const responseData = await response.json();
    expect(responseData).toHaveProperty('error');
    expect(responseData.error).toBe('invalid_client_metadata');
  });

  test('should include proper DCR metadata in registered client', async ({ request }) => {
    const clientMetadata = {
      client_name: 'DCR Metadata Test Client',
      redirect_uris: ['https://example.com/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code']
    };

    const response = await request.post(`${BASE_URL}/oauth/register`, {
      data: clientMetadata,
      headers: {
        'Content-Type': 'application/json'
      },
      ignoreHTTPSErrors: true
    });

    expect(response.status()).toBe(201);
    
    const responseData = await response.json();
    const tempClientId = responseData.client_id;
    const tempToken = responseData.registration_access_token;
    
    // DCRメタデータの確認（カスタムメタデータとして保存されている可能性）
    expect(responseData.client_name).toBe('DCR Metadata Test Client');
    
    // クリーンアップ
    await request.delete(`${BASE_URL}/oauth/register/${tempClientId}`, {
      headers: {
        'Authorization': `Bearer ${tempToken}`
      },
      ignoreHTTPSErrors: true
    });
  });
});
