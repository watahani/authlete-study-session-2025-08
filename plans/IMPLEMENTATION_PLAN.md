# チケット販売サービス実装計画

## プロジェクト概要
Authlete 勉強会 2025-08 のためのチケット販売サービスの実装

## 技術スタック
- **ランタイム**: Node.js + TypeScript
- **Web フレームワーク**: Express.js
- **認証**: Passport.js (ローカル認証)
- **データベース**: MySQL
- **ORM**: 軽量なSQLクライアント (mysql2)
- **テスト**: Playwright
- **コンテナ**: Docker

## ディレクトリ構造
```
src/
├── app.ts                 # Express アプリケーションのメインエントリ
├── config/               
│   └── database.ts       # データベース設定
├── models/               # データモデル
│   ├── User.ts          # ユーザーモデル
│   └── Ticket.ts        # チケットモデル
├── routes/              # API ルート
│   ├── auth.ts          # 認証関連
│   └── tickets.ts       # チケット操作
├── middleware/          # Express ミドルウェア
│   └── auth.ts          # 認証ミドルウェア
├── services/            # ビジネスロジック
│   ├── AuthService.ts   # 認証サービス
│   └── TicketService.ts # チケット管理サービス
└── types/               # TypeScript 型定義
    └── index.ts

public/                  # 静的ファイル
├── index.html          # フロントエンド
├── login.html          # ログインページ
└── tickets.html        # チケット一覧・予約ページ

docker-compose.yml       # MySQL コンテナ
schema.sql              # データベーススキーマ
```

## データベース設計

### users テーブル
- id: PRIMARY KEY (AUTO_INCREMENT)
- username: VARCHAR(50) UNIQUE NOT NULL
- password: VARCHAR(255) NOT NULL (ハッシュ化済み)
- email: VARCHAR(100) UNIQUE NOT NULL
- created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### tickets テーブル
- id: PRIMARY KEY (AUTO_INCREMENT)
- title: VARCHAR(255) NOT NULL
- description: TEXT
- price: DECIMAL(10,2) NOT NULL
- available_seats: INT NOT NULL
- total_seats: INT NOT NULL
- event_date: DATETIME NOT NULL
- created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP

### reservations テーブル
- id: PRIMARY KEY (AUTO_INCREMENT)
- user_id: INT NOT NULL (FOREIGN KEY)
- ticket_id: INT NOT NULL (FOREIGN KEY)
- seats_reserved: INT NOT NULL
- reservation_date: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- status: ENUM('active', 'cancelled') DEFAULT 'active'

## API エンドポイント

### 認証
- POST /auth/register - ユーザー登録
- POST /auth/login - ログイン
- POST /auth/logout - ログアウト
- GET /auth/profile - プロフィール取得

### チケット
- GET /api/tickets - チケット一覧取得
- GET /api/tickets/:id - チケット詳細取得
- POST /api/tickets/:id/reserve - チケット予約
- DELETE /api/reservations/:id - 予約キャンセル
- GET /api/my-reservations - 自分の予約一覧

## 実装フェーズ

### Phase 1: 基盤構築
1. プロジェクト構造作成
2. TypeScript設定
3. Express サーバーセットアップ
4. データベース接続

### Phase 2: 認証システム
1. Passport.js セットアップ
2. ユーザー登録・ログイン機能
3. セッション管理

### Phase 3: チケット管理
1. チケットCRUD操作
2. 予約システム
3. 在庫管理

### Phase 4: フロントエンド
1. 基本的なHTML/CSS/JS
2. ログインフォーム
3. チケット一覧・予約画面

### Phase 5: テスト・Docker
1. Playwright テスト作成
2. Docker環境構築

## 簡略化する部分（デモサービスのため）
- 決済処理はモック
- メール通知は未実装
- 複雑なバリデーションは最小限
- 管理者機能は未実装
- セキュリティは基本的なもののみ