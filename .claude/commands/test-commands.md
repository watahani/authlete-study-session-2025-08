# テスト実行コマンド集

## 概要

このプロジェクトには以下の3種類のテストがあります：

- **OAuth関連テスト**: OAuth 2.1認証フロー、Confidential/Publicクライアント、Authorization Detailsテスト
- **MCPテスト**: Model Context Protocol（MCP）サーバーのテスト（OAuth無効）
- **Ticket Service本体テスト**: アプリケーション本体の機能テスト（OAuth無効）

## 開発環境での実行

### 1. 事前準備

```bash
# 依存関係インストール
npm ci

# SSL証明書生成
npm run generate-ssl

# プロジェクトビルド
npm run build
```

### 2. OAuth関連テスト（推奨）

OAuth認証フローやMCPアクセス制御をテストします。Authlete設定が必要です。

```bash
# OAuthテスト全体実行（推奨）
npm run test:oauth

# または個別実行
npx playwright test --config=playwright-oauth.config.ts

# 特定のOAuthテストのみ
npx playwright test tests/oauth-confidential-client.spec.ts --config=playwright-oauth.config.ts
npx playwright test tests/oauth-authorization-code-flow.spec.ts --config=playwright-oauth.config.ts
npx playwright test tests/oauth-authorization-details.spec.ts --config=playwright-oauth.config.ts
npx playwright test tests/oauth-token-flow.spec.ts --config=playwright-oauth.config.ts
```

### 3. MCPテスト（OAuth無効）

MCP サーバーの基本機能をテストします。

```bash
# MCPテスト実行
npm run test:mcp

# または
npx playwright test --config=playwright-mcp.config.ts
```

### 4. Ticket Service本体テスト

アプリケーション本体の機能をテストします（OAuth無効）。

```bash
# 標準テスト実行
npm test

# または
npx playwright test --config=playwright.config.ts
```

### 5. デバッグ実行

テスト実行時の詳細ログを確認する場合：

```bash
# デバッグログ付きでOAuthテスト実行
LOG_LEVEL=debug npx playwright test --config=playwright-oauth.config.ts

# Playwright UIでインタラクティブ実行
npx playwright test --ui --config=playwright-oauth.config.ts

# テストレポート表示
npx playwright show-report
```

## 手動サーバー起動でのテスト

サーバープロセスを手動制御したい場合：

```bash
# 1. 既存プロセス停止（必要に応じて）
pkill -f "npm run dev" || true
pkill -f "tsx src/app.ts" || true

# 2. サーバー起動
npm run dev &
DEV_PID=$!

# 3. サーバー起動確認
sleep 10
curl -k https://localhost:3443/mcp/health || (kill $DEV_PID && exit 1)

# 4. テスト実行
npx playwright test --config=playwright-oauth.config.ts

# 5. サーバー停止
kill $DEV_PID
```

## GitHub Actions相当のテスト

CI環境で実行されるテストを再現：

```bash
# 1. playwright.yml ワークフロー相当
# 標準テスト（OAuth無効）
MCP_OAUTH_ENABLED=false NODE_ENV=test npx playwright test

# OAuthテスト（OAuth有効）
MCP_OAUTH_ENABLED=true NODE_ENV=development npm run test:oauth

# 2. test-and-cleanup.yml ワークフロー相当
# OAuthテスト（DCR含む）
npx playwright test --reporter=list --config=playwright-oauth.config.ts

# MCPテスト
npx playwright test --reporter=list --config=playwright-mcp.config.ts

# 標準テスト
npx playwright test --reporter=list

# DCRクライアントクリーンアップ
npm run cleanup:dcr:force
```

## 環境変数

### OAuth/Authlete関連
```bash
AUTHLETE_SERVICE_ACCESS_TOKEN=<Authlete サービスアクセストークン>
AUTHLETE_SERVICE_ID=<Authlete サービスID>
AUTHLETE_BASE_URL=https://jp.authlete.com
MCP_PUBLIC_CLIENT_ID=<パブリッククライアントID または mcp-public-client>
CONFIDENTIAL_CLIENT_ID=<機密クライアントID または confidential-test-client>
CONFIDENTIAL_CLIENT_SECRET=<機密クライアントシークレット>
```

### その他
```bash
NODE_ENV=test|development|production
MCP_OAUTH_ENABLED=true|false
LOG_LEVEL=error|warn|info|debug|trace
```

## トラブルシューティング

### サーバー起動エラー
```bash
# ポートが使用中の場合
lsof -ti:3443 | xargs kill -9

# SSL証明書エラー
npm run generate-ssl
```

### テスト失敗時の調査
```bash
# ブラウザログ収集（テストファイル内で有効化）
page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

# ネットワークエラー収集
page.on('requestfailed', request => 
  console.log(`[REQUEST FAILED] ${request.url()}`));
```

### DCRクライアント残留
```bash
# 強制クリーンアップ
npm run cleanup:dcr:force

# 手動確認
npm run cleanup:dcr
```

## パフォーマンス考慮事項

- テスト実行前にビルド（`npm run build`）を推奨
- OAuth テストはAuthlete APIを呼び出すため時間がかかります
- 並行実行数を制限する場合： `--workers=1`
- ヘッドレス無効化： `--headed`（デバッグ時）