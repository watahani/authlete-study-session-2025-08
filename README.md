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

### 3. SSL証明書の生成（HTTPS使用時）
```bash
# Self-signed SSL証明書を生成
npm run generate-ssl
```

### 4. アプリケーションの起動
```bash
# 開発モード（HTTP）
npm run dev

# 開発モード（HTTPS - SSL証明書生成後）
npm run dev:https

# MCP機能も有効にして起動
npm run dev:mcp        # HTTP + MCP
npm run dev:https:mcp  # HTTPS + MCP

# 本番モード
npm run build
npm start
```

### 5. アプリケーションにアクセス
- HTTP: http://localhost:3000
- HTTPS: https://localhost:3443

## 🔒 HTTPS証明書の信頼設定

認可サーバーの実装では **HTTPS必須** のため、Self-signed証明書を信頼する設定が必要です。

### ⚠️ 重要な注意事項
- 以下の設定は **開発環境のみ** で実施してください
- 本番環境では正式なCA署名付き証明書を使用してください
- 開発完了後は必ず証明書を削除してください

### 証明書を信頼する方法

#### **macOS**
```bash
# システムキーチェーンに証明書を追加
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ssl/localhost.crt

# または手動でキーチェーンアクセスから追加
# 1. キーチェーンアクセス.app を開く
# 2. ssl/localhost.crt をダブルクリック
# 3. 「信頼」セクションで「この証明書を使用する時」を「常に信頼」に変更
```

#### **Linux (Ubuntu/Debian)**
```bash
# システムの証明書ストアに追加
sudo cp ssl/localhost.crt /usr/local/share/ca-certificates/localhost.crt
sudo update-ca-certificates

# 結果確認
curl https://localhost:3443/health
```

#### **Windows**
```cmd
# 管理者権限でコマンドプロンプトを開く
certlm.msc

# 証明書マネージャーで以下の手順を実行:
# 1. 「信頼されたルート証明機関」→「証明書」を右クリック
# 2. 「すべてのタスク」→「インポート」
# 3. ssl/localhost.crt を選択してインポート
```

### **ブラウザでの一時的な信頼（推奨）**
システム全体に影響を与えたくない場合:

1. https://localhost:3443 にアクセス
2. 「この接続ではプライバシーが保護されません」画面
3. 「詳細設定」→「localhost にアクセスする（安全ではありません）」をクリック

### 証明書を削除する方法

#### **macOS**
```bash
# システムキーチェーンから削除
sudo security delete-certificate -c "localhost" /Library/Keychains/System.keychain

# または手動削除
# 1. キーチェーンアクセス.app を開く
# 2. システムキーチェーン → 証明書 → "localhost" を選択
# 3. 右クリック → 削除
```

#### **Linux**
```bash
# 証明書ファイルを削除
sudo rm /usr/local/share/ca-certificates/localhost.crt
sudo update-ca-certificates --fresh

# 確認（証明書エラーが表示されれば正常）
curl https://localhost:3443/health
```

#### **Windows**
```cmd
certlm.msc

# 証明書マネージャーで以下の手順:
# 1. 「信頼されたルート証明機関」→「証明書」→「localhost」を選択
# 2. 右クリック → 削除
```

### **MCP Introspector での接続**

1. 証明書を信頼した後、以下のURLでMCPサーバーに接続:
   ```
   https://localhost:3443/mcp
   ```

2. 証明書エラーが表示される場合は上記の信頼設定を確認してください

### **認可サーバーでHTTPSが必要な理由**

- OAuth 2.1 仕様ではHTTPS必須
- Authlete APIへの接続時にセキュアな通信が必要
- アクセストークン・認可コード等の機密情報保護
- ブラウザのセキュリティポリシー（Same-origin policy、CORS）遵守

## 🏗️ プロジェクト構造

```
src/
├── app.ts                 # 統合アプリケーション（HTTP/HTTPS切り替え対応）
├── config/
│   ├── database.ts       # MySQL データベース設定
│   └── mock-database.ts  # モックデータベース設定
├── routes/               # API ルート
│   ├── auth.ts          # 認証API
│   └── tickets.ts       # チケットAPI
├── middleware/
│   └── auth.ts          # 認証ミドルウェア
├── services/            # ビジネスロジック
│   ├── AuthService.ts   # 認証サービス
│   └── TicketService.ts # チケット管理サービス
├── mcp/                 # MCP サーバー実装
│   ├── server.ts        # スタンドアローンMCPサーバー
│   ├── http-main.ts     # HTTP MCP サーバー
│   ├── tools/           # MCP ツール実装
│   ├── data/            # データアクセス層
│   └── config/          # MCP設定
└── types/
    └── index.ts         # TypeScript型定義

public/                  # フロントエンド
├── index.html          # メイン画面
└── app.js              # JavaScript

ssl/                     # SSL証明書（HTTPS使用時）
├── localhost.crt        # 自己署名証明書
└── localhost.key        # 秘密鍵

plans/                   # プロジェクト計画書
└── *.md                # 各種実装計画書
```

## 🔧 API エンドポイント

### システム API
- `GET /health` - ヘルスチェック（プロトコル判定付き）

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

### MCP API
- `POST /mcp` - MCP サーバーエンドポイント
- `GET /mcp/health` - MCP ヘルスチェック
- `GET /mcp/info` - MCP サーバー情報

## 🧪 テスト実行

```bash
# データベースを起動
docker-compose up -d

# すべてのテスト実行（HTTP環境）
npm test

# HTTP環境でのテスト実行
npm run test:http

# HTTPS環境でのテスト実行（SSL証明書生成後）
npm run generate-ssl  # 初回のみ
npm run test:https

# MCP専用テスト
npm run test:mcp              # HTTP環境でのMCPテスト
npm run test:https:specific   # HTTPS特化機能テスト（リダイレクト、セキュリティヘッダー等）

# UI モードでテスト実行
npx playwright test --ui                    # HTTP環境
npx playwright test --ui --config=playwright-https.config.ts  # HTTPS環境
```

### 🔒 HTTP/HTTPS 統合アプリケーション

**v2.0での改善点:**
- `app.ts` と `https-app.ts` を統合し、`HTTPS_ENABLED` 環境変数で切り替え
- `/health` エンドポイントで動的プロトコル判定（HTTP/HTTPS）
- セキュリティヘッダー、CORS、セッション設定を環境に応じて動的設定
- GitHub Actions でHTTP/HTTPSテストを分離実行

**HTTPS環境での自動機能:**
- HTTP→HTTPS 301リダイレクト（ポート3000→3443）
- HSTS、CSP等のセキュリティヘッダー自動設定
- セキュアクッキー設定（`secure: true`）

**テスト分離:**
- `test-http`: HTTPS専用テストを除外してHTTP環境で実行
- `test-https`: SSL証明書生成後にHTTPS専用テストのみ実行

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

### 主要な環境変数

```bash
# サーバー設定
HTTPS_ENABLED=true          # HTTPS有効化（default: false）
HTTP_PORT=3000             # HTTPポート（default: 3000）
HTTPS_PORT=3443            # HTTPSポート（default: 3443）
SESSION_SECRET=your-secret # セッション秘密鍵
MCP_ENABLED=true           # MCP機能有効化（default: false）

# データベース設定（MySQL使用時）
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ticket_service
DB_USER=root
DB_PASSWORD=password
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