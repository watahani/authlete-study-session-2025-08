# チケット販売サービス - Authlete Study Session 2025-08

このプロジェクトは Authlete 勉強会 2025-08 で使用するサンプルのチケット販売サービスです。

## 🚀 クイックスタート

### 1. 依存関係のインストール
```bash
npm install
```

### 2. データベースの起動
```bash
docker-compose up -d
```

### 3. アプリケーションの起動
```bash
# 開発モード
npm run dev

# 本番モード
npm run build
npm start
```

### 4. アプリケーションにアクセス
http://localhost:3000

## 🏗️ プロジェクト構造

```
src/
├── app.ts                 # メインアプリケーション
├── config/
│   └── database.ts       # データベース設定
├── models/               # データモデル（未使用）
├── routes/               # API ルート
│   ├── auth.ts          # 認証API
│   └── tickets.ts       # チケットAPI
├── middleware/
│   └── auth.ts          # 認証ミドルウェア
├── services/            # ビジネスロジック
│   ├── AuthService.ts   # 認証サービス
│   └── TicketService.ts # チケット管理サービス
└── types/
    └── index.ts         # TypeScript型定義

public/                  # フロントエンド
├── index.html          # メイン画面
└── app.js              # JavaScript

plans/                   # プロジェクト計画書
└── IMPLEMENTATION_PLAN.md
```

## 🔧 API エンドポイント

### 認証 API
- `POST /auth/register` - ユーザー登録
- `POST /auth/login` - ログイン
- `POST /auth/logout` - ログアウト
- `GET /auth/profile` - プロフィール取得

### チケット API
- `GET /api/tickets` - チケット一覧
- `GET /api/tickets/:id` - チケット詳細
- `POST /api/tickets/:id/reserve` - チケット予約 (要認証)
- `GET /api/my-reservations` - 予約履歴 (要認証)
- `DELETE /api/reservations/:id` - 予約キャンセル (要認証)

## 🧪 テスト実行

```bash
# データベースを起動
docker-compose up -d

# アプリケーションを起動
npm run dev

# 別ターミナルでテスト実行
npm test

# UI モードでテスト実行
npx playwright test --ui
```

## 📊 データベース

MySQL 8.0 を使用。`schema.sql` にテーブル定義とサンプルデータが含まれています。

### テーブル
- `users` - ユーザー情報
- `tickets` - チケット情報
- `reservations` - 予約情報

## 🔐 環境変数

`.env.example` をコピーして `.env` を作成：

```bash
cp .env.example .env
```

## 🐛 開発時の注意点

- デモサービスのためセキュリティは最小限
- 決済処理はモック
- エラーハンドリングは基本的なもののみ
- バリデーションは最小限

## 📝 次のステップ

1. MCP サーバーの実装
2. OAuth 認可サーバーの構築
3. MCP サーバーとの統合