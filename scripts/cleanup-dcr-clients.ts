#!/usr/bin/env tsx

/**
 * DCR (Dynamic Client Registration) で登録されたクライアントを削除するスクリプト
 * テスト終了後のクリーンアップ用
 */

import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

interface AuthleteClient {
  number: number;
  clientId: number;
  clientIdAlias?: string;
  clientName?: string;
  dynamicallyRegistered: boolean;
  createdAt: number;
  modifiedAt: number;
}

interface AuthleteResponse {
  resultCode: string;
  resultMessage: string;
  clients?: AuthleteClient[];
}

const AUTHLETE_BASE_URL = process.env.AUTHLETE_BASE_URL || 'https://jp.authlete.com';
const SERVICE_ACCESS_TOKEN = process.env.AUTHLETE_SERVICE_ACCESS_TOKEN;
const ORGANIZATION_ACCESS_TOKEN = process.env.ORGANIZATION_ACCESS_TOKEN;
const SERVICE_ID = process.env.AUTHLETE_SERVICE_ID;

if (!SERVICE_ACCESS_TOKEN || !SERVICE_ID) {
  console.error('❌ AUTHLETE_SERVICE_ACCESS_TOKEN または AUTHLETE_SERVICE_ID が設定されていません');
  process.exit(1);
}

if (!ORGANIZATION_ACCESS_TOKEN) {
  console.error('❌ ORGANIZATION_ACCESS_TOKEN が設定されていません（クライアント削除には必要）');
  process.exit(1);
}

/**
 * Authlete APIを呼び出す汎用関数
 */
async function callAuthleteAPI(endpoint: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: any, useOrgToken: boolean = false): Promise<any> {
  const url = `${AUTHLETE_BASE_URL}/api/${SERVICE_ID}${endpoint}`;
  
  const token = useOrgToken ? ORGANIZATION_ACCESS_TOKEN : SERVICE_ACCESS_TOKEN;
  
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authlete API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // レスポンスが空の場合（削除成功など）
    const responseText = await response.text();
    if (!responseText.trim()) {
      return { success: true, status: response.status };
    }

    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      console.warn(`⚠️  JSON解析警告 [${method} ${endpoint}]: レスポンスがJSON形式ではありません`);
      return { success: response.ok, status: response.status, rawResponse: responseText };
    }
  } catch (error) {
    console.error(`❌ API呼び出しエラー [${method} ${endpoint}]:`, error);
    throw error;
  }
}

/**
 * 全クライアント一覧を取得
 */
async function getAllClients(): Promise<AuthleteClient[]> {
  console.log('📋 クライアント一覧を取得中...');
  
  try {
    const response: AuthleteResponse = await callAuthleteAPI('/client/get/list');
    
    if (!response.clients) {
      console.log('ℹ️  クライアントが見つかりませんでした');
      return [];
    }

    console.log(`📊 総クライアント数: ${response.clients.length}`);
    return response.clients;
  } catch (error) {
    console.error('❌ クライアント一覧の取得に失敗しました:', error);
    throw error;
  }
}

/**
 * DCRで登録されたクライアントをフィルタリング
 */
function filterDCRClients(clients: AuthleteClient[]): AuthleteClient[] {
  const dcrClients = clients.filter(client => client.dynamicallyRegistered === true);
  
  console.log(`🔍 DCRクライアント数: ${dcrClients.length}`);
  
  if (dcrClients.length > 0) {
    console.log('📝 DCRクライアント一覧:');
    dcrClients.forEach(client => {
      const createdDate = new Date(client.createdAt).toISOString();
      console.log(`  - ID: ${client.clientIdAlias || client.clientId}, 名前: "${client.clientName || 'N/A'}", 作成日: ${createdDate}`);
    });
  }

  return dcrClients;
}

/**
 * クライアントを削除（ORGANIZATION_ACCESS_TOKEN使用）
 */
async function deleteClient(client: AuthleteClient): Promise<boolean> {
  const clientIdentifier = client.clientIdAlias || client.clientId.toString();
  
  try {
    console.log(`🗑️  クライアント削除中: ${clientIdentifier} (${client.clientName || 'N/A'})`);
    
    // ORGANIZATION_ACCESS_TOKENを使用してクライアントを削除
    const response = await callAuthleteAPI(`/client/delete/${clientIdentifier}`, 'DELETE', undefined, true);
    
    if (response.success === true || response.resultCode?.startsWith('A')) {
      console.log(`✅ クライアント削除成功: ${clientIdentifier}`);
      return true;
    } else {
      console.error(`❌ クライアント削除失敗: ${clientIdentifier} - ${response.resultMessage || 'Unknown error'}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ クライアント削除エラー: ${clientIdentifier}`, error);
    return false;
  }
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  console.log('🧹 DCRクライアント クリーンアップスクリプト開始');
  console.log(`🔗 Authlete サービス: ${SERVICE_ID}`);
  console.log('─'.repeat(50));

  try {
    // 1. 全クライアント取得
    const allClients = await getAllClients();
    
    if (allClients.length === 0) {
      console.log('ℹ️  削除対象のクライアントはありません');
      return;
    }

    // 2. DCRクライアントをフィルタリング
    const dcrClients = filterDCRClients(allClients);
    
    if (dcrClients.length === 0) {
      console.log('ℹ️  DCRで登録されたクライアントはありません');
      return;
    }

    console.log('─'.repeat(50));

    // 3. 削除の確認
    console.log(`⚠️  ${dcrClients.length}個のDCRクライアントを削除します`);
    
    // CI環境では自動実行、ローカルでは確認を求める
    const isCI = process.env.CI === 'true' || process.env.NODE_ENV === 'test';
    
    if (!isCI) {
      console.log('続行する場合は、CONFIRM=yes を環境変数に設定してください');
      if (process.env.CONFIRM !== 'yes') {
        console.log('❌ 削除がキャンセルされました');
        return;
      }
    }

    // 4. DCRクライアントを削除
    console.log('🗑️  DCRクライアント削除開始...');
    
    let successCount = 0;
    let errorCount = 0;

    for (const client of dcrClients) {
      const success = await deleteClient(client);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
      
      // API負荷軽減のため少し待機
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('─'.repeat(50));
    console.log('📊 削除結果:');
    console.log(`  ✅ 成功: ${successCount}個`);
    console.log(`  ❌ 失敗: ${errorCount}個`);
    
    if (errorCount === 0) {
      console.log('🎉 すべてのDCRクライアントが正常に削除されました');
    } else {
      console.log('⚠️  一部のクライアント削除に失敗しました');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  }
}

// スクリプト実行時のエラーハンドリング
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未処理のPromise拒否:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕捉の例外:', error);
  process.exit(1);
});

// メイン処理実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as cleanupDCRClients };