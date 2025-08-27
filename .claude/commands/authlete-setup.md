# Authlete セットアップコマンド

## 概要

このコマンドは Authlete サービスとクライアントのセットアップを自動化します。
開発環境での OAuth 2.1 認証基盤構築とテスト実行に必要な設定を行います。

## 前提条件

1. **Authlete MCP が Claude Code に設定済み**
   - `~/.claude/mcp_servers.json` に authlete サーバーが追加されている
   - `ORGANIZATION_ACCESS_TOKEN` と `ORGANIZATION_ID` が設定されている
   - MCP が接続されていない場合は下記のセットアップ手順を実行

### MCP サーバー接続確認

MCP サーバーが正しく接続されているかを確認するには、以下のコマンドを実行します：

```bash
# Authlete サービス一覧を取得（接続テスト）
mcp__authlete__list_services
```

**接続成功の場合**: サービス一覧のJSONレスポンスが返される
**接続失敗の場合**: エラーメッセージまたは空のレスポンスが返される

2. **プロジェクトファイル**
   - `examples/authlete-service-config.json`（サービス設定）
   - `examples/authlete-clients-config.json`（クライアント設定）

## Authlete MCP のセットアップ手順

### 事前準備：Authlete アカウントの作成

MCP サーバーをセットアップする前に、Authlete アカウントが必要です：

1. **Authlete コンソールにアクセス**: [https://console.authlete.com](https://console.authlete.com)
2. **アカウント作成**: 新規サインアップを実行
3. **組織の作成または選択**: アカウント作成後、組織を作成または既存の組織を選択
4. **組織情報の取得**: 
   - 組織のアクセストークン (`ORGANIZATION_ACCESS_TOKEN`)
   - 組織ID (`ORGANIZATION_ID`)

### MCP サーバーセットアップ

Authlete アカウント準備完了後、以下のコマンドで Authlete MCP サーバーをセットアップしてください：

```bash
claude mcp add authlete --scope local -- docker run --rm -i \
  -e ORGANIZATION_ACCESS_TOKEN=YOUR_ORGANIZATION_ACCESS_TOKEN \
  -e ORGANIZATION_ID=YOUR_ORGANIZATION_ID \
  -e AUTHLETE_API_URL=https://jp.authlete.com \
  -e AUTHLETE_API_SERVER_ID=53285 \
  -e LOG_LEVEL=INFO \
  ghcr.io/watahani/authlete-mcp:latest
```

**環境変数の設定値**:
- `YOUR_ORGANIZATION_ACCESS_TOKEN`: Authlete コンソールから取得した組織のアクセストークン
- `YOUR_ORGANIZATION_ID`: Authlete コンソールから取得した組織ID

**環境変数の取得方法**:
- `ORGANIZATION_ACCESS_TOKEN`、`ORGANIZATION_ID`、`AUTHLETE_API_SERVER_ID` の取得方法は [Authlete Terraform ドキュメント](https://www.authlete.com/developers/terraform/starting/) を参照してください
- 日本リージョンの場合 `AUTHLETE_API_URL` は `https://jp.authlete.com` を `AUTHLETE_API_SERVER_ID` は `53285` を使用します

セットアップ完了後、Claude Code を再起動してからこのコマンドを再実行してください。

## セットアップ手順

### 1. Authlete サービス作成

```bash
# サービス設定ファイルからサービス作成
mcp__authlete__create_service_detailed "$(cat examples/authlete-service-config.json)"
```

作成されたサービスの `serviceId` (SERVICE_API_KEY) をメモしてください。

### 2. OAuth クライアント作成

作成したサービスの SERVICE_API_KEY を使用してクライアントを作成：

```bash
# サービス作成時に取得した SERVICE_API_KEY を設定
SERVICE_API_KEY=your_service_api_key_here

# Confidential Client 作成（clientIdAlias: confidential-test-client）
mcp__authlete__create_client "$(jq '.clients[0]' examples/authlete-clients-config.json)" "$SERVICE_API_KEY"

# Public Client (MCP) 作成（clientIdAlias: mcp-public-client）
mcp__authlete__create_client "$(jq '.clients[1]' examples/authlete-clients-config.json)" "$SERVICE_API_KEY"
```

### 3. 環境変数設定

**重要**: `AUTHLETE_SERVICE_ACCESS_TOKEN` は `SERVICE_API_KEY` とは異なります。
この値は Authlete コンソールから別途取得する必要があります。

**サービスアクセストークンの取得手順**:
1. Authleteコンソール (https://console.authlete.com) にログイン
2. Authlete MCP に設定した組織を選択
3. サービス「Ticket Service OAuth Server」を選択
4. 「サービス設定」→「基本設定」→「詳細設定」→ブレードからサービスアクセストークンを取得

```bash
# .env ファイルまたは環境変数として設定
export AUTHLETE_SERVICE_ACCESS_TOKEN="コンソールから取得したサービスアクセストークン"
export AUTHLETE_SERVICE_ID="your_service_id" 
export AUTHLETE_BASE_URL="https://jp.authlete.com"

# テスト用クライアント設定（clientIdAlias使用時はオプション）
export MCP_PUBLIC_CLIENT_ID="mcp-public-client"
export CONFIDENTIAL_CLIENT_ID="confidential-test-client"
export CONFIDENTIAL_CLIENT_SECRET="your_confidential_client_secret"
```

**注意**: 
- `SERVICE_API_KEY`: サービス作成時に取得される値（クライアント管理用）
- `AUTHLETE_SERVICE_ACCESS_TOKEN`: Authlete コンソールから別途取得する値（認証処理用）

### 4. 設定確認

```bash
# サービス情報確認
mcp__authlete__get_service "$SERVICE_API_KEY"

# クライアント一覧確認  
mcp__authlete__list_clients "$SERVICE_API_KEY"

# 特定クライアント確認
mcp__authlete__get_client "confidential-test-client" "$SERVICE_API_KEY"
mcp__authlete__get_client "mcp-public-client" "$SERVICE_API_KEY"
```

## セットアップスクリプト例

以下を参考にセットアップを実行：

```bash
#!/bin/bash
set -e

echo "🚀 Authlete セットアップを開始..."

# 1. サービス作成
echo "📋 Authlete サービス作成中..."
SERVICE_RESPONSE=$(mcp__authlete__create_service_detailed "$(cat examples/authlete-service-config.json)")
SERVICE_API_KEY=$(echo "$SERVICE_RESPONSE" | jq -r '.apiKey')

if [ "$SERVICE_API_KEY" = "null" ] || [ -z "$SERVICE_API_KEY" ]; then
  echo "❌ サービス作成に失敗しました"
  exit 1
fi

echo "✅ サービス作成成功: $SERVICE_API_KEY"

# 2. クライアント作成
echo "🔑 OAuth クライアント作成中..."

# Confidential Client
echo "  - Confidential Client (confidential-test-client)"
CONF_CLIENT=$(mcp__authlete__create_client "$(jq '.clients[0]' examples/authlete-clients-config.json)" "$SERVICE_API_KEY")
CONF_CLIENT_SECRET=$(echo "$CONF_CLIENT" | jq -r '.clientSecret')

# Public Client  
echo "  - Public Client (mcp-public-client)"
mcp__authlete__create_client "$(jq '.clients[1]' examples/authlete-clients-config.json)" "$SERVICE_API_KEY"

echo "✅ クライアント作成完了"

# 3. 環境変数テンプレート生成
echo "📝 .env テンプレート生成中..."
cat > .env.template << EOF
# Authlete 設定（コンソールから取得が必要）
AUTHLETE_SERVICE_ACCESS_TOKEN=コンソールから取得したサービスアクセストークン
AUTHLETE_SERVICE_ID=$SERVICE_API_KEY
AUTHLETE_BASE_URL=https://jp.authlete.com

# テスト用クライアント設定
MCP_PUBLIC_CLIENT_ID=mcp-public-client
CONFIDENTIAL_CLIENT_ID=confidential-test-client
CONFIDENTIAL_CLIENT_SECRET=$CONF_CLIENT_SECRET

# その他
NODE_ENV=development
MCP_OAUTH_ENABLED=true
LOG_LEVEL=info
EOF

echo "✅ .env.template ファイルを生成しました"
echo ""
echo "🎉 Authlete セットアップ完了！"
echo ""
echo "📋 Next Steps:"
echo "   1. Authleteコンソール (https://console.authlete.com) にログイン"
echo "   2. Authlete MCP に設定した組織を選択"
echo "   3. サービス「Ticket Service OAuth Server」を選択"
echo "   4. 「サービス設定」→「基本設定」→「詳細設定」→ブレードからサービスアクセストークンを取得"
echo "   5. .env.template を .env にコピーして AUTHLETE_SERVICE_ACCESS_TOKEN を設定"
echo ""
echo "🔒 TLS証明書の作成:"
echo "   6. npm run generate-ssl"
echo ""
echo "🚀 サーバー起動:"
echo "   7. npm run dev"
echo ""
echo "🧪 MCP Introspectorでのテスト:"
echo "   8. NODE_EXTRA_CA_CERTS=\"\$PWD/ssl/localhost.crt\" npx @modelcontextprotocol/inspector https://localhost:3443/mcp"
echo ""
echo "💡 OAuth無効モードでのテスト（開発時）:"
echo "   - サーバー: MCP_OAUTH_ENABLED=false npm run dev"
echo "   - Introspector: NODE_EXTRA_CA_CERTS=\"\$PWD/ssl/localhost.crt\" npx @modelcontextprotocol/inspector https://localhost:3443/mcp"
```

## トラブルシューティング

### MCP サーバー接続エラー
```bash
# MCP サーバー状態確認
ListMcpResourcesTool authlete

# MCP 設定確認
cat ~/.claude/mcp_servers.json
```

### サービス作成エラー
```bash
# 組織情報確認
echo $ORGANIZATION_ACCESS_TOKEN
echo $ORGANIZATION_ID

# サービス一覧確認
mcp__authlete__list_services
```

### クライアント作成エラー
```bash
# サービス情報確認
mcp__authlete__get_service "$SERVICE_API_KEY"

# JSON設定ファイル確認
jq . examples/authlete-clients-config.json
```

### 認証エラー
```bash
# 環境変数設定確認
env | grep AUTHLETE
env | grep CLIENT_ID
env | grep CLIENT_SECRET

# SERVICE_ACCESS_TOKEN がコンソールから正しく取得されているか確認
echo "AUTHLETE_SERVICE_ACCESS_TOKEN: $AUTHLETE_SERVICE_ACCESS_TOKEN"
```

## 重要な設定値の区別

| 設定値 | 用途 | 取得方法 |
|--------|------|----------|
| `SERVICE_API_KEY` | クライアント管理API呼び出し | サービス作成時のレスポンスから取得 |
| `AUTHLETE_SERVICE_ACCESS_TOKEN` | OAuth認証処理 | Authleteコンソールから手動取得 |
| `ORGANIZATION_ACCESS_TOKEN` | MCP組織管理 | 組織管理者から取得 |

## 📋 セットアップ完了後の Next Steps

Authlete MCP サーバーのセットアップが完了したら、以下の手順でアプリケーションを起動・テストしてください：

### 1. 環境変数の最終設定

```bash
# .env.template を .env にコピー
cp .env.template .env

# .env ファイルを編集して AUTHLETE_SERVICE_ACCESS_TOKEN を設定
# この値は Authleteコンソールから別途取得が必要です
```

### 2. TLS証明書の作成

HTTPS必須の認可サーバーのため、自己署名証明書を作成：

```bash
npm run generate-ssl
```

### 3. サーバーの起動

```bash
# HTTPS + OAuth + MCP 統合モード（推奨）
npm run dev

# デバッグログ有効化（詳細な情報が必要な場合）
LOG_LEVEL=debug npm run dev
```

### 4. MCP Introspector でのテスト

OAuth認証フローとMCPツールの動作確認：

```bash
# 自己署名証明書を認識してMCP Introspectorを起動
NODE_EXTRA_CA_CERTS="$PWD/ssl/localhost.crt" \
npx @modelcontextprotocol/inspector https://localhost:3443/mcp
```

**テスト手順**:
1. Introspector が Dynamic Client Registration を自動実行
2. ブラウザで OAuth 認可フローが開始
3. 認証完了後、MCPツールが利用可能になる

**利用可能なツール**:
- `list_tickets` - チケット一覧取得
- `search_tickets` - チケット検索  
- `reserve_ticket` - チケット予約
- `cancel_reservation` - 予約キャンセル
- `get_user_reservations` - 予約履歴取得

### 5. 開発・テスト時の OAuth 無効モード

開発時は認証を無効化して簡単にテスト可能：

```bash
# OAuth無効モードでサーバー起動
MCP_OAUTH_ENABLED=false npm run dev

# 認証なしでIntrospector接続
NODE_EXTRA_CA_CERTS="$PWD/ssl/localhost.crt" \
npx @modelcontextprotocol/inspector https://localhost:3443/mcp
```

### 6. 自動テストの実行

```bash
# 全テスト実行
npx playwright test

# MCP サーバーテスト（OAuth無効）
MCP_OAUTH_ENABLED=false npx playwright test tests/mcp-server.spec.ts

# OAuth統合テスト（実際のトークンフロー）
npx playwright test tests/oauth-token-flow.spec.ts
```

## 参考情報

- [Authlete 公式ドキュメント](https://docs.authlete.com/)
- [OAuth 2.1 仕様](https://tools.ietf.org/html/draft-ietf-oauth-v2-1)
- [MCP 仕様](https://modelcontextprotocol.io/specification/)