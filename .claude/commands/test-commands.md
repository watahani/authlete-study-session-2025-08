# テスト実行コマンド集

## 簡単実行版

```bash
# OAuth middlewareテスト（サーバー起動確認付き）
npm run build && npm run dev &
DEV_PID=$!
sleep 5
curl -k https://localhost:3443/mcp/health && kill $DEV_PID
npx playwright test tests/oauth-middleware.spec.ts --config=playwright-oauth.config.ts

# OAuthテスト全体実行
npm run build && npm run dev &
DEV_PID=$!
sleep 5
curl -k https://localhost:3443/mcp/health && kill $DEV_PID
npx playwright test --config=playwright-oauth.config.ts

# MCPテスト実行
npm run build && npm run dev &
DEV_PID=$!
sleep 5
curl -k https://localhost:3443/mcp/health && kill $DEV_PID
npx playwright test tests/mcp-server.spec.ts
```

## 安全な実行版（プロセス停止付き）

```bash
# 既存プロセス停止 → ビルド → 起動確認 → テスト
pkill -f "npm run dev" || true
npm run build
npm run dev &
DEV_PID=$!
sleep 10
curl -k https://localhost:3443/mcp/health || (kill $DEV_PID && exit 1)
kill $DEV_PID
npx playwright test tests/oauth-middleware.spec.ts --config=playwright-oauth.config.ts
```