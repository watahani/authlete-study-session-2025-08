# OAuth テスト実行コマンド

OAuth機能のテストを実行するコマンドです。最新のコードでサーバーが正常に起動することを確認してからテストを実行します。

## 使用方法

```bash
# 1. 既存のサーバープロセスを停止（もしあれば）
pkill -f "npm run dev" || true
pkill -f "tsx src/app.ts" || true

# 2. ビルド実行
npm run build

# 3. サーバーが正常に起動することを確認
timeout 30s npm run dev &
DEV_PID=$!
sleep 10
curl -k https://localhost:3443/mcp/health || (kill $DEV_PID && exit 1)
kill $DEV_PID

# 4. OAuthテスト実行
npx playwright test --config=playwright-oauth.config.ts
```

## 個別コマンド

```bash
# OAuth middlewareテストのみ実行
# (上記の1-3の手順を実行してから)
npx playwright test tests/oauth-middleware.spec.ts --config=playwright-oauth.config.ts

# MCPテスト実行（OAuth無効）
# (上記の1-3の手順を実行してから)
npx playwright test tests/mcp-server.spec.ts
```

## 重要な注意事項

- テスト実行前にサーバーの起動確認を必ず行う
- 既存のサーバープロセスは事前に停止する
- OAuth関連テストは `playwright-oauth.config.ts` 設定を使用する
- テスト実行時は新しいサーバーインスタンスが自動起動される