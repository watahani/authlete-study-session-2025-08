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

# Confidential Client
mcp__authlete__create_client "$(jq '.clients[0]' examples/authlete-clients-config.json)" --service_api_key=$SERVICE_API_KEY

# Public Client (MCP)
mcp__authlete__create_client "$(jq '.clients[1]' examples/authlete-clients-config.json)" --service_api_key=$SERVICE_API_KEY
```