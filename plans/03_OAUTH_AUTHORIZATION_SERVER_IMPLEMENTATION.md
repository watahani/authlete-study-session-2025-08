# OAuth認可サーバー実装計画

## 概要

Authlete 3.0をバックエンドとしたOAuth 2.1準拠の認可サーバーを実装し、MCPサーバーの保護機能を提供する。

## 実装目標

1. **OAuth 2.1 準拠の認可サーバー構築**
2. **Authlete 3.0 API統合**
3. **MCPサーバーの保護機能実装**
4. **OAuth Authorization Code Flowサポート**
5. **スコープベースのアクセス制御**
6. **Dynamic Client Registration の実装**

## システム設計

### アーキテクチャ構成

既存の認証システムに認可サーバーを組み込む

```
[Claude/MCP Client]
       ↓ OAuth 2.1 Flow + Dynamic Client Registration
[OAuth Authorization Server (ticket-service)] ←→ [Authlete 3.0 API]
       ↓ Protected Access
[MCP Server] ←→ [Ticket Service]
```

## 詳細実装プラン


### 1. プロジェクト構造

```
src/oauth/
├── server.ts                   # OAuth認可サーバーのメインエントリ  
├── config/
│   ├── oauth-config.ts         # OAuth設定管理
│   └── authlete-config.ts      # Authlete API設定
├── controllers/
│   ├── authorization.ts        # 認可エンドポイント (/authorize)
│   ├── token.ts               # トークンエンドポイント (/token)
│   ├── userinfo.ts            # ユーザー情報エンドポイント (/userinfo)
│   ├── revocation.ts          # トークン無効化 (/revoke)
│   ├── registration.ts        # Dynamic Client Registration (/register)
│   └── discovery.ts           # OpenID Connect Discovery (/well-known)
├── authlete/
│   ├── client.ts              # Authlete APIクライアント
│   ├── handlers/
│   │   ├── authorization-handler.ts
│   │   ├── token-handler.ts
│   │   ├── userinfo-handler.ts
│   │   └── client-registration-handler.ts
│   └── types/                 # 既存のtypesディレクトリを活用
├── middleware/
│   ├── cors.ts               # CORS設定
│   ├── csrf.ts               # CSRF保護
│   ├── mcp-auth.ts           # MCP認証ミドルウェア
│   └── error-handler.ts      # エラーハンドリング
└── utils/
    ├── crypto.ts             # 暗号化ユーティリティ
    └── validators.ts         # リクエスト検証
```

### 2. OAuth 2.1 エンドポイント実装

#### 必須エンドポイント：

1. **認可エンドポイント** (`/oauth/authorize`)
   - Authorization Code Flow開始
   - PKCE必須（OAuth 2.1要件）
   - ユーザー認証・同意画面表示

2. **トークンエンドポイント** (`/oauth/token`) 
   - 認可コードからアクセストークン発行
   - PKCE検証
   - リフレッシュトークン対応

3. **ユーザー情報エンドポイント** (`/oauth/userinfo`)
   - アクセストークンによるユーザー情報取得
   - OpenID Connect準拠

4. **トークン無効化エンドポイント** (`/oauth/revoke`)
   - アクセストークン・リフレッシュトークン無効化

5. **Dynamic Client Registration エンドポイント** (`/oauth/register`)
   - RFC 7591準拠のクライアント動的登録
   - MCP クライアント自動登録対応

6. **Discovery エンドポイント** (`/.well-known/oauth-authorization-server`)
   - OAuth設定情報公開

### 3. Authlete API 統合設計

```typescript
interface AuthleteApiClient {
  // 認可リクエスト処理
  authorize(request: AuthorizationRequest): Promise<AuthorizationResponse>;
  
  // トークン発行処理  
  token(request: TokenRequest): Promise<TokenResponse>;
  
  // ユーザー情報取得
  userinfo(request: UserinfoRequest): Promise<UserinfoResponse>;
  
  // トークン無効化
  revoke(request: RevocationRequest): Promise<RevocationResponse>;
  
  // イントロスペクション（トークン検証）
  introspect(request: IntrospectionRequest): Promise<IntrospectionResponse>;
  
  // Dynamic Client Registration
  registerClient(request: ClientRegistrationRequest): Promise<ClientRegistrationResponse>;
  
  // クライアント情報取得
  getClient(clientId: string): Promise<ClientResponse>;
}
```

### 4. MCP サーバー保護機能

#### MCP Specification 2025-06-18 準拠

1. **Bearer Token認証**
   - Authorization ヘッダーでのアクセストークン受信
   - Authlete introspectionでのトークン検証

2. **スコープベースアクセス制御**
   - `tickets:read` - チケット検索・一覧
   - `tickets:write` - チケット予約・キャンセル  
   - `profile:read` - ユーザー情報取得

3. **MCP認証ミドルウェア**
   ```typescript
   interface McpAuthMiddleware {
     validateToken(token: string): Promise<TokenInfo>;
     checkScope(requiredScope: string, tokenInfo: TokenInfo): boolean;
   }
   ```

### 5. Dynamic Client Registration 実装詳細

#### RFC 7591 準拠の実装

```typescript
interface ClientRegistrationRequest {
  client_name: string;
  client_uri?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope: string;
  token_endpoint_auth_method: string;
  // MCP特有のメタデータ
  mcp_server_info?: {
    name: string;
    version: string;
    vendor: string;
  };
}

interface ClientRegistrationResponse {
  client_id: string;
  client_secret?: string;
  client_id_issued_at: number;
  client_secret_expires_at?: number;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope: string;
  token_endpoint_auth_method: string;
}
```

#### MCP クライアント自動登録フロー

1. **初回接続時の自動登録**
   - MCP クライアント起動時に `/oauth/register` へPOST
   - クライアント情報の自動生成・登録
   - client_id/client_secret の返却

2. **登録済みクライアントの管理**
   - クライアント情報の永続化
   - クライアント更新・削除機能

## 6. 追加の高度な機能 (オプション)

### Pushed Authorization Requests (PAR)
- **エンドポイント**: `/oauth/par`
- **目的**: 認可リクエストの事前送信によるセキュリティ強化
- **Authlete API**: `/api/{serviceId}/pushed_auth_req`

### Client Initiated Backchannel Authentication (CIBA)
- **エンドポイント**: `/oauth/backchannel_authentication`  
- **目的**: デバイス間認証フローの実装
- **Authlete API**: `/api/{serviceId}/backchannel/authentication`

### Grant Management
- **エンドポイント**: `/oauth/grants`
- **目的**: ユーザーによる許可済みアクセス管理
- **Authlete API**: `/api/{serviceId}/gm`

## 7. 実装タスクの優先順位

### フェーズ1: 基盤構築 (必須)
1. ✅ **Authlete APIクライアント実装**
   - `/api/{serviceId}/auth/authorization`
   - `/api/{serviceId}/auth/token` 
   - `/api/{serviceId}/auth/userinfo`
   - `/api/{serviceId}/auth/revocation`
   - `/api/{serviceId}/auth/introspection`

2. ✅ **基本的なOAuth 2.1エンドポイント**
   - `/oauth/authorize`
   - `/oauth/token`
   - `/oauth/userinfo` 
   - `/oauth/revoke`

3. ✅ **Discovery エンドポイント**
   - `/.well-known/oauth-authorization-server`
   - Authlete API: `/api/{serviceId}/service/configuration`

### フェーズ2: Dynamic Client Registration (推奨)
1. ✅ **クライアント登録エンドポイント**
   - `/oauth/register` (POST) - 新規クライアント登録
   - Authlete API: `/api/{serviceId}/client/registration`

2. ✅ **クライアント管理エンドポイント** (RFC 7592)
   - `/oauth/register/{client_id}` (GET) - クライアント情報取得
   - `/oauth/register/{client_id}` (PUT) - クライアント情報更新  
   - `/oauth/register/{client_id}` (DELETE) - クライアント削除
   - Authlete APIs: 
     - `/api/{serviceId}/client/registration/get`
     - `/api/{serviceId}/client/registration/update`
     - `/api/{serviceId}/client/registration/delete`

### フェーズ3: MCP統合 (必須)
1. ✅ **MCP認証ミドルウェア実装**
   - Bearer Token認証
   - スコープベースアクセス制御

2. ✅ **既存MCPサーバーとの統合**
   - 認証ミドルウェアの適用
   - エラーハンドリングの統合

### フェーズ4: 高度な機能 (オプション)
1. **Pushed Authorization Requests (PAR)**
   - `/oauth/par` エンドポイント
   - Authlete API: `/api/{serviceId}/pushed_auth_req`

2. **Client Initiated Backchannel Authentication (CIBA)**
   - `/oauth/backchannel_authentication` エンドポイント
   - Authlete API: `/api/{serviceId}/backchannel/authentication`

## 8. エンドポイント実装における注意点

### セキュリティ要件
- **PKCE必須**: OAuth 2.1ではPKCEが全フローで必須
- **HTTPS必須**: 本番環境では全エンドポイントでHTTPS必須
- **CSRF Protection**: 認可エンドポイントでのCSRF対策
- **Rate Limiting**: 各エンドポイントでの適切なレート制限

### エラーハンドリング
- **標準化されたエラーレスポンス**: RFC 6749準拠のエラー形式
- **適切なHTTPステータスコード**: 各エラー種別に対応
- **ログ記録**: セキュリティイベントの適切な記録

### パフォーマンス考慮事項
- **キャッシング**: Discovery情報やJWKSのキャッシング
- **接続プール**: Authlete APIクライアントの接続管理
- **非同期処理**: 重い処理の非同期化
