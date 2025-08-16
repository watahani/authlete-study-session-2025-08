// ロガーシステムのテスト用スクリプト
import { logger, createLogger, oauthLogger, mcpLogger } from './src/utils/logger.js';

console.log('=== ロガーシステム テスト ===\n');

// デフォルトロガーのテスト
logger.error('エラーメッセージのテスト');
logger.warn('警告メッセージのテスト');
logger.info('情報メッセージのテスト');
logger.debug('デバッグメッセージのテスト（LOG_LEVEL=debug の場合のみ表示）');
logger.trace('トレースメッセージのテスト（LOG_LEVEL=trace の場合のみ表示）');

// コンテキスト付きロガーのテスト
console.log('\n--- コンテキスト付きロガー ---');
const customLogger = createLogger('CUSTOM');
customLogger.info('カスタムコンテキスト付きログ');

// 専用ロガーのテスト
console.log('\n--- 専用ロガー ---');
oauthLogger.debug('OAuth関連のデバッグログ');
mcpLogger.info('MCP関連の情報ログ');

// データ付きログのテスト
console.log('\n--- データ付きログ ---');
logger.info('ユーザー認証完了', {
  userId: 'test123',
  timestamp: new Date(),
  clientIp: '127.0.0.1'
});

// 子ロガーのテスト
console.log('\n--- 子ロガー ---');
const childLogger = logger.child('AUTH');
childLogger.debug('子ロガーからのデバッグログ');

const grandChildLogger = childLogger.child('TOKEN');
grandChildLogger.trace('孫ロガーからのトレースログ');

console.log('\n=== テスト完了 ===');