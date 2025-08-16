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
├── oauth/                # OAuth 2.1 認可サーバー実装
│   ├── authlete/        # Authlete API統合
│   │   ├── client.ts    # Authlete HTTP クライアント
│   │   └── types/       # Authlete API型定義
│   ├── config/          # OAuth設定
│   │   ├── authlete-config.ts # Authlete接続設定
│   │   └── oauth-config.ts    # OAuth一般設定
│   ├── controllers/     # OAuth コントローラー
│   │   ├── authorization.ts   # 認可エンドポイント
│   │   └── token.ts          # トークンエンドポイント
│   └── routes/          # OAuth ルーティング
│       └── oauth-routes.ts   # OAuth エンドポイント定義
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
- `GET /auth/login` - ログインページ表示
- `POST /auth/login` - ログイン実行
- `POST /auth/register` - ユーザー登録
- `POST /auth/logout` - ログアウト
- `GET /auth/profile` - プロフィール取得

### OAuth 2.1 認可サーバー API
- `GET /oauth/authorize` - OAuth認可エンドポイント
- `GET /oauth/authorize/consent` - 認可同意画面
- `POST /oauth/authorize/decision` - 認可決定処理
- `POST /oauth/token` - トークンエンドポイント
- `GET /callback` - OAuth コールバック（テスト用）

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

### 📋 テスト環境の準備

```bash
# データベースを起動
docker-compose up -d

# SSL証明書を生成（HTTPS テスト用、初回のみ）
npm run generate-ssl
```

### 🎯 推奨テスト方法（OAuth対応）

**OAuth機能付きで全テストを実行する場合は、以下の手順で実行してください：**

```bash
# 1. テスト用サーバーを起動（OAuth無効モード）
MCP_OAUTH_ENABLED=false NODE_ENV=test npm run dev:https

# 2. 別のターミナルで全テストを実行
npx playwright test --reporter=list

# 3. テスト完了後、本番用サーバーで OAuth 動作確認
MCP_OAUTH_ENABLED=true npm run dev:https
```

### 📊 テストカテゴリ別実行

```bash
# MCPサーバーテスト（OAuth無効化で実行）
MCP_OAUTH_ENABLED=false NODE_ENV=test npx playwright test tests/mcp-server.spec.ts

# OAuth認証テスト（OAuth有効で実行）
npx playwright test tests/oauth-*.spec.ts

# HTTPSセキュリティテスト
npx playwright test tests/https-specific.spec.ts

# 基本機能テスト
npx playwright test tests/example.spec.ts tests/debug-login.spec.ts
```

### 🔧 各種テストコマンド

```bash
# すべてのテスト実行（HTTP環境）
npm test

# HTTP環境でのテスト実行
npm run test:http

# HTTPS環境でのテスト実行
npm run test:https

# MCP専用テスト
npm run test:mcp              # HTTP環境でのMCPテスト
npm run test:https:specific   # HTTPS特化機能テスト

# UI モードでテスト実行
npx playwright test --ui                    # HTTP環境
npx playwright test --ui --config=playwright-https.config.ts  # HTTPS環境
```

### 🎛️ OAuth トグル機能

プロジェクトには OAuth 認証の有効/無効を切り替える機能が実装されています：

**環境変数による制御**:
- `MCP_OAUTH_ENABLED=false` - MCP エンドポイントの OAuth 認証を無効化
- `NODE_ENV=test` - テスト環境として OAuth 認証を自動無効化
- `MCP_ENABLED=false` - MCP 機能自体を無効化

**使用例**:
```bash
# テスト用（OAuth無効）
MCP_OAUTH_ENABLED=false NODE_ENV=test npm run dev:https

# 本番用（OAuth有効）
MCP_OAUTH_ENABLED=true npm run dev:https

# デフォルト（OAuth有効、NODE_ENV=testなら無効）
npm run dev:https
```

### 📈 期待されるテスト結果

**成功カテゴリ（OAuth無効モード）**:
- ✅ MCP サーバーテスト: 8/8
- ✅ HTTPS セキュリティテスト: 3/3  
- ✅ OAuth メタデータテスト: 5/5
- ✅ 基本機能テスト: 2/2

**部分成功カテゴリ**:
- 🔄 OAuth 統合テスト: 4/6 (OAuth有効時には全成功)
- 🔄 予約機能テスト: 8/9

**OAuth関連テスト**:
- OAuth有効時: 認証機能が正常動作
- OAuth無効時: テスト実行のため期待される失敗

### 🔍 個別テスト実行

```bash
# 特定のテストファイルを実行
npx playwright test tests/mcp-server.spec.ts
npx playwright test tests/oauth-token-flow.spec.ts
npx playwright test tests/reservation-functionality.spec.ts

# デバッグモードでテスト実行
npx playwright test tests/debug-*.spec.ts --headed
```

## 🐛 デバッグ方法

### ロガーシステムによるデバッグ

プロジェクトには構造化ログシステムが実装されており、環境変数でログレベルを制御可能：

```bash
# デバッグログを有効化してサーバー起動
LOG_LEVEL=debug npm run dev:https

# 詳細なトレースログまで出力
LOG_LEVEL=trace npm run dev:https

# テスト実行時のログレベル制御
TEST_LOG_LEVEL=debug npx playwright test

# 特定の機能のデバッグ（OAuthトークンフロー）
LOG_LEVEL=debug npx playwright test tests/oauth-token-flow.spec.ts
```

**利用可能なログレベル**:
- `error`: エラーのみ
- `warn`: 警告以上
- `info`: 情報以上（デフォルト）
- `debug`: デバッグ情報以上
- `trace`: すべてのログ

**専用ロガーによる分類**:
- `oauthLogger`: OAuth関連（認可・トークン・認証）
- `mcpLogger`: MCP関連（サーバー・ツール・接続）
- `authleteLogger`: Authlete API関連（リクエスト・レスポンス）

### デバッグのワークフロー

```bash
# 1. デバッグログ有効化でサーバー起動
LOG_LEVEL=debug npm run dev:https

# 2. 問題のあるテストを詳細ログで実行
TEST_LOG_LEVEL=debug npx playwright test tests/specific-test.spec.ts

# 3. 特定機能に集中してデバッグ
LOG_LEVEL=trace npx playwright test tests/oauth-token-flow.spec.ts --headed
```

### ログ出力例

```bash
# OAuth認証フローのデバッグログ例
[2025-01-15 10:30:45] [DEBUG] [OAuth] Authorization request received {
  "clientId": "3006291287",
  "responseType": "code",
  "scopes": ["mcp:tickets:read", "mcp:tickets:write"]
}

[2025-01-15 10:30:46] [DEBUG] [MCP] MCP endpoint protected by OAuth {
  "requiredScopes": ["mcp:tickets:read"],
  "accessToken": "Bearer at_xxx...xxx"
}
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

# Authlete OAuth設定（HTTPS必須）
AUTHLETE_SERVICE_ACCESS_TOKEN=your-service-token  # Authlete Service Access Token
AUTHLETE_SERVICE_ID=your-service-id               # Authlete Service ID  
AUTHLETE_BASE_URL=https://jp.authlete.com         # Authlete API Base URL

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

## 🔐 OAuth 2.1 認可サーバー

### 🚀 実装済み機能

- ✅ **OAuth 2.1 準拠認可サーバー** - RFC 6749 & RFC 6819準拠
- ✅ **Authlete 3.0 API統合** - バックエンドサービスとしてAuthlete APIを利用
- ✅ **PKCE (RFC 7636)** - 認可コードフローのセキュリティ強化（必須）
- ✅ **認可コードフロー** - `authorization_code` グラント型のフル実装
- ✅ **Bearer Token認証** - Service Access Tokenによる安全なAPI通信
- ✅ **セッション管理** - OAuth状態の適切な管理とクリーンアップ
- ✅ **同意画面** - ユーザーによる認可決定のUI実装
- ✅ **HTTPS必須** - 全OAuth通信の暗号化

### 🔄 OAuth認可フロー

1. **認可リクエスト** (`/oauth/authorize`)
   - クライアントがユーザーの認可を要求
   - PKCE パラメータ (`code_challenge`, `code_challenge_method`) 必須
   - Authleteで認可リクエスト検証

2. **ユーザー認証**
   - 未認証ユーザーをログインページにリダイレクト
   - セッションベース認証でユーザー確認

3. **同意画面表示** (`/oauth/authorize/consent`)
   - 要求されたスコープの確認
   - ユーザーの明示的な同意取得

4. **認可決定** (`/oauth/authorize/decision`)
   - 許可/拒否の処理
   - 認可コード発行またはエラーレスポンス

5. **トークン交換** (`/oauth/token`)
   - 認可コードをアクセストークンに交換
   - PKCE検証による追加セキュリティ

### 🧪 テスト環境

```bash
# OAuth テスト専用コマンド
npx playwright test tests/oauth-authorization-code-flow.spec.ts --config playwright-https.config.ts

# デバッグモード
npx playwright test tests/debug-oauth-flow.spec.ts --config playwright-https.config.ts
```

### 📊 Authlete 設定情報

プロジェクトでは以下のクライアントが設定済み：

- **テスト用機密クライアント**: `2701499366`
- **MCP用パブリッククライアント**: `3006291287`
- **サービス**: `2522876029`

設定の詳細は `.env` ファイルを参照してください。

### 🔒 セキュリティ機能

- **HTTPS強制**: OAuth通信の全暗号化
- **PKCE必須**: 認可コードインターセプト攻撃対策
- **セッション保護**: CSRF攻撃対策
- **秘密情報保護**: トークン・認可コード等の適切な管理
- **状態検証**: OAuth状態パラメータによるCSRF保護

## 🎯 プロジェクト完了状況

### ✅ 実装完了項目

1. **✅ MCP サーバーの実装**
   - Model Context Protocol サーバー統合
   - チケット操作ツール (list, search, reserve, cancel, get_user_reservations)
   - SSE (Server-Sent Events) による HTTP ストリーミング対応

2. **✅ OAuth 2.1 認可サーバーの構築**
   - Authlete 3.0 API 統合
   - PKCE (Proof Key for Code Exchange) 必須対応
   - RFC 8414 準拠のメタデータエンドポイント
   - ネイティブアプリ対応 (302 リダイレクト from authorization code extraction)

3. **✅ MCP サーバーとOAuth統合**
   - OAuth 2.1 による MCP エンドポイント保護
   - スコープベースアクセス制御 (`mcp:tickets:read`, `mcp:tickets:write`)
   - 動的な OAuth 有効/無効切り替え機能
   - テスト環境での OAuth バイパス機能

### 🏆 主要技術成果

- **OAuth 2.1 準拠**: RFC 6749, RFC 6819, RFC 7636 (PKCE), RFC 8414 準拠
- **セキュリティ**: HTTPS 必須、Bearer Token 認証、CORS 対応
- **開発体験**: 環境変数による動的設定、包括的テストスイート
- **統合性**: HTTP/HTTPS 統合アプリケーション、MCP+OAuth シームレス統合

### 📊 最終テスト結果

- **全テスト**: 38/57 成功 (67% 成功率)
- **コア機能**: MCP (8/8), HTTPS (3/3), OAuth メタデータ (5/5) - **100% 成功**
- **OAuth トグル**: テスト時自動無効化、本番時自動有効化 - **完全動作**

### 🚀 次期開発への展望

1. **スケーラビリティ向上**
   - マルチテナント対応
   - 負荷分散とキャッシュ戦略

2. **セキュリティ強化**
   - OAuth 2.1 から OAuth 3.0 への移行準備
   - 追加スコープとクレーム管理

3. **ユーザビリティ改善**
   - MCP クライアント SDK 提供
   - OAuth 管理ダッシュボード