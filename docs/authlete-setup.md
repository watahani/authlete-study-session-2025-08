# Authlete MCP セットアップ

## Claude Code への Authlete MCP 追加

### 1. MCPサーバー設定
`~/.claude/mcp_servers.json` に以下を追加:

```json
{
  "authlete": {
    "command": "docker",
    "args": [
      "run", "-i", "--rm",
      "-e", "ORGANIZATION_ACCESS_TOKEN=your_organization_token",
      "-e", "ORGANIZATION_ID=your_organization_id",
      "ghcr.io/watahani/authlete-mcp:latest"
    ]
  }
}
```

## サービス・クライアント設定復元

### 1. サービス作成
```bash
mcp__authlete__create_service_detailed "$(cat examples/authlete-service-config.json)"
```

### 2. クライアント作成
```bash
SERVICE_API_KEY=your_service_api_key

# Confidential Client (clientIdAlias: confidential-test-client)
mcp__authlete__create_client "$(jq '.clients[0]' examples/authlete-clients-config.json)" --service_api_key=$SERVICE_API_KEY

# Public Client (MCP) (clientIdAlias: mcp-public-client)
mcp__authlete__create_client "$(jq '.clients[1]' examples/authlete-clients-config.json)" --service_api_key=$SERVICE_API_KEY
```

### 3. テスト用環境変数設定（オプション）

デフォルトでは clientIdAlias が使用されますが、必要に応じて環境変数でオーバーライド可能:

```bash
# .env または環境変数として設定
MCP_PUBLIC_CLIENT_ID=mcp-public-client
CONFIDENTIAL_CLIENT_ID=confidential-test-client  
CONFIDENTIAL_CLIENT_SECRET=your_confidential_client_secret
```