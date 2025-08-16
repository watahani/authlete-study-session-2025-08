# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Authlete Study Session 2025-08

このプロジェクトは Auhtlete 勉強会 2025-08 で利用するサンプルコードです。
MCP サーバーを Authlete をバックエンドとして利用する認可サーバーを実装します。

## プロジェクト構造

このプロジェクトは段階的に実装される3つのコンポーネントから構成されます：

1. **チケット販売サービス** (Web アプリケーション)
   - passport.js による認証システム
   - チケット検索・予約・キャンセル機能
   - MySQL による永続化
   - デモサービスなのでできる限りシンプルな実装
   - 本質的ではない昨日はモックや未実装で問題ない
   
2. **MCP サーバー** (Model Context Protocol)
   - @modelcontextprotocol/sdk 使用
   - Streamable HTTP で公開
   - チケット操作ツール提供
   
3. **OAuth 認可サーバー**
   - Authlete 3.0 をバックエンドに利用
   - OAuth 2.1 準拠
   - MCP サーバーの保護 (https://modelcontextprotocol.io/specification/2025-06-18 に準拠)

## 技術スタック

- **ランタイム**: Node.js + TypeScript
- **Web フレームワーク**: Express.js
- **認証**: Passport.js
- **データベース**: MySQL
- **インフラ**: Docker
- **テスト**: Playwright
- **MCP**: @modelcontextprotocol/sdk

## 開発コマンド

```bash
# テスト実行
npx playwright test

# Playwright UI モードでテスト実行
npx playwright test --ui

# テスト結果のレポート表示
npx playwright show-report

# HTTPS モードでの開発サーバー起動
npm run dev:https
```

## デバッグ方法

### Playwright テストデバッグ

Playwright テスト内でブラウザのコンソールログ、ネットワークエラー、リクエスト失敗を収集するには以下のコードを追加する：

```typescript
test('テスト名', async ({ page }) => {
  // ブラウザコンソールログを収集
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    console.log(`[BROWSER ${type.toUpperCase()}] ${text}`);
  });
  
  // ネットワークエラーやレスポンス失敗を収集
  page.on('response', response => {
    if (!response.ok()) {
      console.log(`[NETWORK ERROR] ${response.status()} ${response.url()}`);
    }
  });
  
  page.on('requestfailed', request => {
    console.log(`[REQUEST FAILED] ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  // テストコード
});
```

### サーバーサイドデバッグ

#### ロガーシステムを使用したデバッグ

プロジェクトには構造化ログシステムが実装されており、環境変数でログレベルを制御できる：

```bash
# デバッグログを有効化してサーバー起動
LOG_LEVEL=debug npm run dev:https

# 詳細なトレースログまで出力
LOG_LEVEL=trace npm run dev:https

# テスト実行時のログレベル制御
TEST_LOG_LEVEL=debug npx playwright test
```

**利用可能なログレベル**:
- `error`: エラーのみ
- `warn`: 警告以上
- `info`: 情報以上（デフォルト）
- `debug`: デバッグ情報以上
- `trace`: すべてのログ

**専用ロガー**:
- `oauthLogger`: OAuth関連のログ
- `mcpLogger`: MCP関連のログ  
- `authleteLogger`: Authlete API関連のログ

#### バックグラウンドサーバーログの確認

```bash
# バックグラウンドで実行中の npm run dev:https のログを確認
# BashOutput ツールを使用してリアルタイムログを取得
```

## Git ワークフロー

機能単位でブランチを切って開発を進めます：

```bash
# 機能ブランチの作成
git checkout -b feature/ticket-search
git checkout -b feature/user-authentication
git checkout -b feature/mcp-server

# 開発完了後
git add src/specific-file.ts  # 個別にファイルを追加（git add . は禁止）
git commit -m "feat: implement ticket search functionality"
git push origin feature/ticket-search
```

## 実装プロセス

新機能を実装する際は以下のステップに従います：

1. **計画段階**: 実装計画を詳細に出力し、計画ファイルとして保存
2. **タスク管理**: TodoWrite でタスクを管理し進捗を追跡
3. **設計段階**: 必要なファイル構成やAPIインターフェースを定義
4. **実装段階**: 機能の段階的実装とテストの追加
5. **検証段階**: 動作確認とコードレビュー

実装計画ファイルには以下を含める：
- 実装対象の機能詳細
- 必要なファイルとディレクトリ構造
- データモデルとAPI仕様
- テストケース
- 依存関係と前提条件

## 開発原則

- TypeScript の `any` や `unknown` 型を避ける
- クラスは Error 継承などの必要な場合のみ使用
- ハードコーディングを避ける
- Authlete API は SDK を使わず HTTP クライアントで直接呼び出し

## Git 使用ルール

- **`git add .` は使用禁止**: 変更したファイルを個別に指定して追加する
- コミット前に必ず変更内容を確認し、意図しないファイルが含まれていないことを確認する
