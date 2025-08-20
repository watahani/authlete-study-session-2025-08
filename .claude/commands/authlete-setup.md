# Authlete セットアップコマンド

## 概要

このコマンドは Authlete サービスとクライアントのセットアップを自動化します。
開発環境での OAuth 2.1 認証基盤構築とテスト実行に必要な設定を行います。

## 前提条件

1. **Authlete MCP が Claude Code に設定済み**
   - `~/.claude/mcp_servers.json` に authlete サーバーが追加されている
   - `ORGANIZATION_ACCESS_TOKEN` と `ORGANIZATION_ID` が設定されている

2. **プロジェクトファイル**
   - `examples/authlete-service-config.json`（サービス設定）
   - `examples/authlete-clients-config.json`（クライアント設定）

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
echo "📋 次の手順:"
echo "   1. Authlete コンソールから AUTHLETE_SERVICE_ACCESS_TOKEN を取得"
echo "   2. .env.template を .env にコピーして AUTHLETE_SERVICE_ACCESS_TOKEN を設定"
echo "   3. テスト実行: npm run test:oauth"
echo ""
echo "🎉 Authlete セットアップ完了！"
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

## 参考情報

- [Authlete 公式ドキュメント](https://docs.authlete.com/)
- [OAuth 2.1 仕様](https://tools.ietf.org/html/draft-ietf-oauth-v2-1)
- [MCP 仕様](https://modelcontextprotocol.io/specification/)