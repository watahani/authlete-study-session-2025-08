# MCP サーバー実装計画

## 概要

チケット販売サービスと連携する Model Context Protocol (MCP) サーバーを実装します。
@modelcontextprotocol/sdk を使用して、チケット操作ツールを提供する HTTP サーバーを構築します。

## 実装ステップ

### ステップ 1: MCP サーバーの基本セットアップ

**目標**: MCP SDK を使用した基本的なサーバー構造の構築

**実装内容**:
- `@modelcontextprotocol/sdk` の依存関係追加
- MCP サーバーのエントリーポイント作成
- 基本的なサーバー設定とルーティング

**ファイル構成**:
```
src/mcp/
├── server.ts              # MCP サーバーのメインファイル  
├── config/
│   └── mcp-config.ts      # MCP サーバー設定
└── types/
    └── mcp-types.ts       # MCP 関連の型定義
```

### ステップ 2: チケット操作ツールの実装

**目標**: MCP クライアント向けのチケット操作ツール提供

**実装内容**:
- `list_tickets` ツール: 利用可能なチケット一覧取得
- `search_tickets` ツール: 条件指定でのチケット検索
- `reserve_ticket` ツール: チケット予約実行
- `cancel_reservation` ツール: 予約キャンセル実行
- `get_user_reservations` ツール: ユーザーの予約履歴取得

**ファイル構成**:
```
src/mcp/tools/
├── ticket-tools.ts       # チケット関連ツールの実装
├── auth-tools.ts         # 認証関連ツール（必要に応じて）
└── types/
    └── tool-schemas.ts   # ツールのスキーマ定義
```

### ステップ 3: Streamable HTTP での公開設定

**目標**: MCP サーバーを HTTP 経由でアクセス可能にする

**実装内容**:
- HTTP サーバーとしての公開設定
- CORS 設定とセキュリティヘッダー
- リクエスト/レスポンスのログ記録
- エラーハンドリングの実装

**ファイル構成**:
```
src/mcp/
├── http-server.ts        # HTTP サーバーラッパー
├── middleware/
│   ├── cors.ts           # CORS 設定
│   ├── logging.ts        # リクエストログ
│   └── error-handler.ts  # エラーハンドリング
└── routes/
    └── mcp-routes.ts     # MCP エンドポイント
```

### ステップ 4: Cedar による権限管理の実装

**目標**: Cedar policy language による拡張性の高い権限管理システム

**実装内容**:
- Cedar SDK の統合とポリシー評価エンジン
- AccessRights の定義とポリシー作成
- Tool 実行前の権限チェック機能
- 粒度の細かい権限管理（例: 5000円以下のチケット予約権限）

**Cedar Policy 例**:
```cedar
// Admin 権限
permit (
  principal in Role::"Admin",
  action in [Action::"list_tickets", Action::"search_tickets", 
             Action::"reserve_ticket", Action::"cancel_reservation", 
             Action::"get_user_reservations"],
  resource
);

// チケット検索のみの権限
permit (
  principal in Role::"TicketViewer",
  action in [Action::"list_tickets", Action::"search_tickets"],
  resource
);

// 価格制限付き予約権限
permit (
  principal in Role::"BudgetUser", 
  action in [Action::"list_tickets", Action::"search_tickets", 
             Action::"reserve_ticket"],
  resource
) when {
  action != Action::"reserve_ticket" || 
  resource.price <= 5000
};
```

**ファイル構成**:
```
src/mcp/auth/
├── cedar-engine.ts       # Cedar ポリシー評価エンジン
├── access-rights.ts      # AccessRights 定義
├── policy-loader.ts      # ポリシー管理
├── authorization.ts      # 認可チェック
└── policies/
    ├── admin.cedar       # Admin 権限ポリシー
    ├── ticket-viewer.cedar  # 表示のみ権限
    └── budget-user.cedar    # 価格制限付き権限
```

### ステップ 5: データアクセス層の実装

**目標**: チケット販売サービスとの連携基盤

**実装内容**:
- TicketService との連携インターフェース
- データベース接続管理
- トランザクション処理
- キャッシュ機能（Redis 準備）

**ファイル構成**:
```
src/mcp/data/
├── ticket-repository.ts  # チケットデータアクセス
├── user-repository.ts    # ユーザーデータアクセス  
├── connection-manager.ts # DB 接続管理
└── cache/
    └── redis-cache.ts    # キャッシュ管理（準備）
```

### ステップ 6: 設定管理とロギング

**目標**: 運用に必要な設定管理とログ機能

**実装内容**:
- 環境変数による設定管理
- 構造化ログの実装
- メトリクス収集準備
- ヘルスチェックエンドポイント

**ファイル構成**:
```
src/mcp/
├── config/
│   ├── environment.ts    # 環境設定
│   └── logging.ts        # ログ設定
├── monitoring/
│   ├── health-check.ts   # ヘルスチェック
│   └── metrics.ts        # メトリクス（準備）
└── utils/
    └── logger.ts         # ログユーティリティ
```

### ステップ 7: テスト実装

**目標**: MCP サーバーの品質保証

**実装内容**:
- 単体テスト（各ツールの動作確認）
- 統合テスト（MCP プロトコル準拠確認）
- E2E テスト（実際のクライアント連携）
- パフォーマンステスト

**ファイル構成**:
```
tests/mcp/
├── unit/
│   ├── ticket-tools.test.ts
│   └── auth.test.ts
├── integration/
│   └── mcp-server.test.ts
├── e2e/
│   └── client-integration.test.ts
└── performance/
    └── load-test.ts
```

### ステップ 8: Docker 化と CI/CD 統合

**目標**: デプロイ可能な形での提供

**実装内容**:
- MCP サーバー用 Dockerfile
- docker-compose での統合
- GitHub Actions ワークフロー拡張
- コンテナイメージのビルドとテスト

**ファイル構成**:
```
docker/
├── mcp-server/
│   └── Dockerfile
├── docker-compose.mcp.yml
└── scripts/
    └── start-mcp.sh
```

## 技術仕様

### 依存関係
- `@modelcontextprotocol/sdk`: MCP プロトコル実装
- `@cedar-policy/cedar-wasm`: Cedar ポリシー言語 (WebAssembly)
- `express`: HTTP サーバー（必要に応じて）
- `cors`: CORS 対応
- `helmet`: セキュリティヘッダー
- `winston`: ログ管理
- `joi`: スキーマ検証

### MCP ツール仕様

#### list_tickets
- **説明**: 利用可能なチケットの一覧を取得
- **パラメータ**: なし
- **戻り値**: チケット配列（ID、タイトル、価格、席数、日時）

#### search_tickets
- **説明**: 条件を指定してチケットを検索
- **パラメータ**: 
  - `title` (optional): タイトル部分一致
  - `max_price` (optional): 最大価格
  - `min_available_seats` (optional): 最小席数
- **戻り値**: 条件に合致するチケット配列

#### reserve_ticket  
- **説明**: 指定されたチケットを予約
- **パラメータ**:
  - `ticket_id` (required): チケットID
  - `seats` (required): 予約席数
  - `user_id` (required): ユーザーID
- **戻り値**: 予約情報（予約ID、ステータス）

#### cancel_reservation
- **説明**: 予約をキャンセル
- **パラメータ**:
  - `reservation_id` (required): 予約ID
  - `user_id` (required): ユーザーID
- **戻り値**: キャンセル結果

#### get_user_reservations
- **説明**: ユーザーの予約履歴を取得
- **パラメータ**:
  - `user_id` (required): ユーザーID
- **戻り値**: 予約履歴配列

### セキュリティ要件
- Cedar ポリシーによる粒度の細かい権限管理
- CORS 設定による適切なオリジン制御
- 入力値検証とサニタイゼーション
- ログ記録によるアクセス監査

### Cedar 権限管理仕様
- **Admin**: 全ての操作が可能
- **TicketViewer**: チケット一覧・検索のみ可能
- **BudgetUser**: 5000円以下のチケット予約が可能
- **将来拡張**: 特定イベント限定、時間制限等の粒度で権限設定可能

## 実装優先順位

1. **高優先度**: ステップ 1-3（基本機能とツール実装）
2. **中優先度**: ステップ 4-6（認証とデータアクセス）  
3. **低優先度**: ステップ 7-8（テストと運用対応）

## リスクと対策

### 技術リスク
- **MCP SDK の学習コスト**: 公式ドキュメントとサンプルコードの事前調査
- **Cedar ポリシー言語の習得**: 実装計画に示したサンプルポリシーで段階的習得
- **チケットサービスとの連携**: インターフェース設計の事前合意

## 成功基準

- MCP クライアントからチケット操作ツールが正常に利用可能
- 全てのツールが MCP プロトコル仕様に準拠
- Cedar ポリシーによる権限管理が正常に動作
- Admin/TicketViewer/BudgetUser の3つの権限レベルが実装済み
- 粒度の細かい権限制御（価格制限等）が動作確認済み