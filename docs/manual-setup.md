# 手動セットアップ（Claude Code なしの場合）

Claude Code を使用していない場合は、jq と curl を使用して手動でサービスとクライアントを作成できます。

## 前提条件

- [Authlete Terraform ドキュメント](https://www.authlete.com/developers/terraform/starting/)から以下を取得：
  - `ORGANIZATION_ACCESS_TOKEN`
  - `ORGANIZATION_ID`  
  - `AUTHLETE_API_SERVER_ID` (日本リージョン: `53285`)
- `jq` コマンドがインストール済み
- `curl` コマンドがインストール済み

## 1. サービス作成 (Authlete IdP API)

```bash
# 環境変数を設定
export ORGANIZATION_ACCESS_TOKEN="YOUR_ORGANIZATION_ACCESS_TOKEN"
export ORGANIZATION_ID="YOUR_ORGANIZATION_ID"
export AUTHLETE_API_SERVER_ID="53285"  # 日本リージョン

# サービス設定を読み込み
SERVICE_CONFIG=$(cat examples/authlete-service-config.json)

# サービス作成リクエスト
SERVICE_RESPONSE=$(curl -s -X POST "https://login.authlete.com/api/service" \
  -H "Authorization: Bearer $ORGANIZATION_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"apiServerId\": $AUTHLETE_API_SERVER_ID,
    \"organizationId\": $ORGANIZATION_ID,
    \"service\": $SERVICE_CONFIG
  }")

# サービス ID を抽出
SERVICE_API_KEY=$(echo "$SERVICE_RESPONSE" | jq -r '.apiKey')
echo "Service API Key (SERVICE_ID): $SERVICE_API_KEY"
```

## 2. クライアント作成

```bash
# クライアント設定を読み込み
CLIENTS_CONFIG=$(cat examples/authlete-clients-config.json)

# クライアントシークレット保存用変数
CONFIDENTIAL_CLIENT_SECRET=""

# 各クライアントを作成
echo "$CLIENTS_CONFIG" | jq -c '.clients[]' | while IFS= read -r client; do
  CLIENT_ALIAS=$(echo "$client" | jq -r '.clientIdAlias')
  echo "Creating client: $CLIENT_ALIAS"
  
  CLIENT_RESPONSE=$(curl -s -X POST "https://jp.authlete.com/api/$SERVICE_API_KEY/client/create" \
    -H "Authorization: Bearer $ORGANIZATION_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$client")
  
  CLIENT_SECRET=$(echo "$CLIENT_RESPONSE" | jq -r '.clientSecret // "N/A"')
  CLIENT_ID=$(echo "$CLIENT_RESPONSE" | jq -r '.clientId')
  echo "  Client ID: $CLIENT_ID"
  echo "  Client ID Alias: $CLIENT_ALIAS"
  echo "  Client Secret: $CLIENT_SECRET"
  
  # Confidential クライアントのシークレットを保存
  if [ "$CLIENT_ALIAS" = "confidential-test-client" ]; then
    CONFIDENTIAL_CLIENT_SECRET="$CLIENT_SECRET"
  fi
  echo ""
done

# シークレットを環境変数に設定（次のステップで使用）
export CONFIDENTIAL_CLIENT_SECRET
```

## 3. 環境変数ファイル作成

```bash
# .env ファイルを作成
cat > .env << EOF
# =============================================================================
# Authlete 基本設定（必須）
# =============================================================================

# Authlete サービスアクセストークン（Authleteコンソールから取得が必要）
# ⚠️  SERVICE_API_KEY とは異なる値です
AUTHLETE_SERVICE_ACCESS_TOKEN=

# Authlete サービス設定
AUTHLETE_SERVICE_ID=$SERVICE_API_KEY
AUTHLETE_BASE_URL=https://jp.authlete.com

# =============================================================================
# OAuth クライアント設定
# =============================================================================

# Confidential Client（テスト用）
CONFIDENTIAL_CLIENT_ID=confidential-test-client
CONFIDENTIAL_CLIENT_SECRET=$CONFIDENTIAL_CLIENT_SECRET

# Public Client（MCP用）
MCP_PUBLIC_CLIENT_ID=mcp-public-client

# =============================================================================
# アプリケーション設定
# =============================================================================

# 開発環境設定
NODE_ENV=development
MCP_OAUTH_ENABLED=true
HTTPS_ENABLED=true

# ログレベル（trace, debug, info, warn, error）
LOG_LEVEL=info
TEST_LOG_LEVEL=debug

# サーバー設定
PORT=3443
HTTP_PORT=3000

# =============================================================================
# セッション設定
# =============================================================================

# セッション暗号化キー（本番環境では変更必須）
SESSION_SECRET=your-super-secret-session-key-change-in-production
EOF

echo "==============================================================================="
echo "セットアップが完了しました！"
echo "==============================================================================="
echo "Service API Key: $SERVICE_API_KEY"
echo "Confidential Client Secret: $CONFIDENTIAL_CLIENT_SECRET"
echo ""
echo "重要: 次のステップを実行してください："
echo "1. Authleteコンソール (https://au1.authlete.com/) にログイン"
echo "2. サービス設定 → 基本設定 → 詳細設定 → ブレードから"
echo "3. AUTHLETE_SERVICE_ACCESS_TOKEN を取得"
echo "4. .env ファイルの AUTHLETE_SERVICE_ACCESS_TOKEN に設定"
echo ""
echo "注意: AUTHLETE_SERVICE_ACCESS_TOKEN は SERVICE_API_KEY ($SERVICE_API_KEY) とは異なります"
echo "==============================================================================="
```

## 4. 完了後の確認

```bash
# アプリケーションを起動して動作確認
npm run dev
```

## ワンライナー実行版

全手順を一括で実行したい場合は、以下のワンライナーを使用できます：

```bash
# 環境変数を設定（YOUR_* の部分を実際の値に置き換えてください）
export ORGANIZATION_ACCESS_TOKEN="YOUR_ORGANIZATION_ACCESS_TOKEN" \
export ORGANIZATION_ID="YOUR_ORGANIZATION_ID" \
export AUTHLETE_API_SERVER_ID="53285" && \
SERVICE_CONFIG=$(cat examples/authlete-service-config.json) && \
SERVICE_RESPONSE=$(curl -s -X POST "https://login.authlete.com/api/service" \
  -H "Authorization: Bearer $ORGANIZATION_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"apiServerId\": $AUTHLETE_API_SERVER_ID, \"organizationId\": $ORGANIZATION_ID, \"service\": $SERVICE_CONFIG}") && \
SERVICE_API_KEY=$(echo "$SERVICE_RESPONSE" | jq -r '.apiKey') && \
CLIENTS_CONFIG=$(cat examples/authlete-clients-config.json) && \
CONFIDENTIAL_CLIENT_RESPONSE=$(curl -s -X POST "https://jp.authlete.com/api/$SERVICE_API_KEY/client/create" \
  -H "Authorization: Bearer $ORGANIZATION_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(echo "$CLIENTS_CONFIG" | jq '.clients[0]')") && \
MCP_CLIENT_RESPONSE=$(curl -s -X POST "https://jp.authlete.com/api/$SERVICE_API_KEY/client/create" \
  -H "Authorization: Bearer $ORGANIZATION_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(echo "$CLIENTS_CONFIG" | jq '.clients[1]')") && \
CONFIDENTIAL_CLIENT_SECRET=$(echo "$CONFIDENTIAL_CLIENT_RESPONSE" | jq -r '.clientSecret') && \
cat > .env << EOF
AUTHLETE_SERVICE_ACCESS_TOKEN=
AUTHLETE_SERVICE_ID=$SERVICE_API_KEY
AUTHLETE_BASE_URL=https://jp.authlete.com
CONFIDENTIAL_CLIENT_ID=confidential-test-client
CONFIDENTIAL_CLIENT_SECRET=$CONFIDENTIAL_CLIENT_SECRET
MCP_PUBLIC_CLIENT_ID=mcp-public-client
NODE_ENV=development
MCP_OAUTH_ENABLED=true
HTTPS_ENABLED=true
LOG_LEVEL=info
TEST_LOG_LEVEL=debug
PORT=3443
HTTP_PORT=3000
SESSION_SECRET=your-super-secret-session-key-change-in-production
EOF
echo "Setup completed! Service API Key: $SERVICE_API_KEY" && \
echo "⚠️  Don't forget to set AUTHLETE_SERVICE_ACCESS_TOKEN in .env from Authlete Console!"
```

## 重要な注意事項

- **`AUTHLETE_SERVICE_ACCESS_TOKEN`** は `SERVICE_API_KEY` とは **異なる値** です
- Authlete コンソール → サービス設定 → 基本設定 → 詳細設定 → ブレードから取得してください
- セットアップ後は `.env` ファイルの `AUTHLETE_SERVICE_ACCESS_TOKEN` を設定する必要があります

## トラブルシューティング

### よくあるエラー

1. **404 Not Found**: エンドポイントURLが間違っています
   - サービス作成: `https://login.authlete.com/api/service`
   - クライアント作成: `https://jp.authlete.com/api/{serviceId}/client/create`

2. **401 Unauthorized**: `ORGANIZATION_ACCESS_TOKEN` が無効です
   - [Authlete Terraform ドキュメント](https://www.authlete.com/developers/terraform/starting/)から再取得してください

3. **jq: command not found**: `jq` がインストールされていません
   ```bash
   # Ubuntu/Debian
   sudo apt-get install jq
   
   # macOS
   brew install jq
   ```

4. **環境変数が設定されない**: シェルの違いによる問題
   - bashやzshで実行してください
   - 必要に応じて `source ~/.bashrc` または `source ~/.zshrc` を実行