import express from 'express';
import https from 'https';
import fs from 'fs';
import session from 'express-session';
import passport from 'passport';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

import { MockDatabaseConfig as DatabaseConfig } from './config/mock-database.js';
import { AuthService } from './services/AuthService.js';
import { authRoutes } from './routes/auth.js';
import { ticketRoutes } from './routes/tickets.js';
import { oauthRoutes } from './oauth/routes/oauth-routes.js';
import { TicketTools } from './mcp/tools/ticket-tools.js';
import { 
  listTicketsToolSchema,
  searchTicketsToolSchema,
  reserveTicketToolSchema,
  cancelReservationToolSchema,
  getUserReservationsToolSchema
} from './mcp/tools/types/tool-schemas.js';
import { ToolResult, UserContext } from './mcp/types/mcp-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// 環境変数からHTTPS有効/無効を判定
const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true';
const HTTP_PORT = process.env.HTTP_PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const PORT = HTTPS_ENABLED ? HTTPS_PORT : HTTP_PORT;

const app = express();

// MCP サーバーインスタンス
let mcpServer: Server | null = null;
let mcpTransport: StreamableHTTPServerTransport | null = null;

// SSL証明書のパス
const SSL_KEY_PATH = path.join(__dirname, '../ssl/localhost.key');
const SSL_CERT_PATH = path.join(__dirname, '../ssl/localhost.crt');

// SSL証明書の存在確認
const checkSSLCertificates = (): boolean => {
  try {
    return fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH);
  } catch {
    return false;
  }
};

// TODO: CSPの無効化は一時的な対処法です。OAuth consent formの問題を根本的に解決する必要があります
// セキュリティヘッダー（HTTPS/HTTPに応じて設定）
const helmetConfig: any = {
  contentSecurityPolicy: false, // CSPを完全に無効化
  crossOriginEmbedderPolicy: false
};

// HTTPS専用のセキュリティヘッダー
if (HTTPS_ENABLED) {
  helmetConfig.hsts = {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  };
}

app.use(helmet(helmetConfig));

// CORS設定（HTTPS/HTTPに応じて設定）
const corsOrigins = [
  'https://claude.ai',
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/\[::1\]:\d+$/
];

// HTTPS有効時はHTTPS URLも許可
if (HTTPS_ENABLED) {
  corsOrigins.push(
    /^https:\/\/localhost:\d+$/,
    /^https:\/\/127\.0\.0\.1:\d+$/,
    /^https:\/\/\[::1\]:\d+$/
  );
}

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id', 'mcp-protocol-version']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// セッション設定（HTTPS/HTTPに応じて設定）
app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: HTTPS_ENABLED, // HTTPS時のみセキュアクッキーを有効
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24時間
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.use('/api', ticketRoutes);
app.use('/oauth', oauthRoutes);

// OAuth 2.0 Metadata Endpoints (RFC 8414)
import { getAuthorizationServerMetadata } from './oauth/controllers/authorization-server-metadata.js';
import { getProtectedResourceMetadata } from './oauth/controllers/protected-resource-metadata.js';

// OAuth 2.0 Authorization Server Metadata with CORS - allow all origins for metadata discovery
const metadataCorsOptions = {
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'mcp-protocol-version'],
  credentials: false  // Public metadata doesn't need credentials
};

app.get('/.well-known/oauth-authorization-server', cors(metadataCorsOptions), getAuthorizationServerMetadata);

// OAuth 2.0 Protected Resource Metadata
app.get('/.well-known/oauth-protected-resource', getProtectedResourceMetadata);
app.get('/.well-known/oauth-protected-resource/mcp', getProtectedResourceMetadata);

// テスト用OAuthコールバックエンドポイント
app.get('/callback', (req, res) => {
  const { code, error, error_description, state } = req.query;
  
  if (error) {
    res.send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>OAuth Error</title>
      </head>
      <body>
        <h1>OAuth Authorization Error</h1>
        <p><strong>Error:</strong> ${error}</p>
        <p><strong>Description:</strong> ${error_description || 'No description provided'}</p>
        <p><strong>State:</strong> ${state || 'No state provided'}</p>
      </body>
      </html>
    `);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>OAuth Success</title>
      </head>
      <body>
        <h1>OAuth Authorization Success</h1>
        <p><strong>Authorization Code:</strong> ${code}</p>
        <p><strong>State:</strong> ${state || 'No state provided'}</p>
      </body>
      </html>
    `);
  }
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ヘルスチェックエンドポイント（HTTP/HTTPS対応）
app.get('/health', (req, res) => {
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' || HTTPS_ENABLED ? 'HTTPS' : 'HTTP';
  res.json({
    status: 'OK',
    protocol: protocol,
    timestamp: new Date().toISOString(),
    service: 'Authlete Study Session Ticket Service'
  });
});

// MCP サーバー初期化
const initializeMCPServer = async (): Promise<void> => {

  // MCP サーバー作成
  mcpServer = new Server(
    {
      name: 'authlete-study-session-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {
          listChanged: false
        }
      }
    }
  );

  // ツール一覧ハンドラー
  mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        listTicketsToolSchema,
        searchTicketsToolSchema,
        reserveTicketToolSchema,
        cancelReservationToolSchema,
        getUserReservationsToolSchema
      ]
    };
  });

  // ツール実行ハンドラー
  mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    try {
      const result = await handleToolCall(name, args || {});
      return {
        content: result.content,
        isError: result.isError || false
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  });

  // トランスポート作成
  mcpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  // サーバーとトランスポートを接続
  await mcpServer.connect(mcpTransport);

  // OAuth認証ミドルウェアをインポート
  const { oauthAuthentication } = await import('./oauth/middleware/oauth-middleware.js');

  // MCP エンドポイントを追加（OAuth認証付き）
  app.post('/mcp', 
    oauthAuthentication({
      requiredScopes: ['mcp:tickets:read'], // 基本的な読み取りスコープを要求
      requireSSL: HTTPS_ENABLED
    }),
    async (req, res) => {
    try {
      if (!mcpTransport) {
        return res.status(503).json({
          error: {
            code: -32603,
            message: 'MCP server not initialized',
            data: 'Server is starting up'
          }
        });
      }
      await mcpTransport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request handling failed:', error);
      res.status(500).json({
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });

  // MCP ヘルスチェック
  app.get('/mcp/health', (_req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'MCP Ticket Server'
    });
  });

  // MCP サーバー情報
  app.get('/mcp/info', (_req, res) => {
    res.json({
      name: 'authlete-study-session-mcp-server',
      version: '1.0.0',
      capabilities: {
        tools: {
          listChanged: false
        }
      },
      endpoints: {
        mcp: '/mcp',
        health: '/mcp/health',
        info: '/mcp/info'
      }
    });
  });

  console.log('MCP Server initialized successfully');
};

// MCP ツール処理
const handleToolCall = async (name: string, args: any): Promise<ToolResult> => {
  // TODO: ユーザーコンテキストの取得を実装
  const userContext: UserContext | undefined = undefined;

  switch (name) {
    case "list_tickets":
      return TicketTools.listTickets(args, userContext);
    case "search_tickets":
      return TicketTools.searchTickets(args, userContext);
    case "reserve_ticket":
      return TicketTools.reserveTicket(args, userContext);
    case "cancel_reservation":
      return TicketTools.cancelReservation(args, userContext);
    case "get_user_reservations":
      return TicketTools.getUserReservations(args, userContext);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
};

const startServer = async (): Promise<void> => {
  try {
    await DatabaseConfig.initialize();
    AuthService.initializePassport();
    await initializeMCPServer();

    if (HTTPS_ENABLED) {
      // HTTPS モード
      
      // SSL証明書の確認
      if (!checkSSLCertificates()) {
        console.error('❌ SSL証明書が見つかりません');
        console.log('以下のコマンドでSSL証明書を生成してください:');
        console.log('  npm run generate-ssl');
        console.log('または:');
        console.log('  ./scripts/generate-ssl-cert.sh');
        process.exit(1);
      }

      // SSL証明書を読み込み
      const privateKey = fs.readFileSync(SSL_KEY_PATH, 'utf8');
      const certificate = fs.readFileSync(SSL_CERT_PATH, 'utf8');
      const credentials = { key: privateKey, cert: certificate };

      // HTTPサーバー（HTTPSへのリダイレクト用）
      const httpApp = express();
      httpApp.use((req, res) => {
        const httpsUrl = `https://${req.headers.host?.replace(/:\d+/, `:${HTTPS_PORT}`)}${req.url}`;
        res.redirect(301, httpsUrl);
      });

      // HTTPSサーバーを起動
      const httpsServer = https.createServer(credentials, app);
      
      httpsServer.listen(HTTPS_PORT, () => {
        console.log(`🔒 HTTPS Server running on https://localhost:${HTTPS_PORT}`);
        console.log(`🔗 MCP endpoint: https://localhost:${HTTPS_PORT}/mcp`);
        console.log(`💚 MCP health check: https://localhost:${HTTPS_PORT}/mcp/health`);
        console.log(`📊 App health check: https://localhost:${HTTPS_PORT}/health`);
      });

      // HTTPサーバーを起動（リダイレクト用）
      httpApp.listen(HTTP_PORT, () => {
        console.log(`↗️  HTTP Server running on http://localhost:${HTTP_PORT} (redirects to HTTPS)`);
      });

    } else {
      // HTTP モード
      app.listen(PORT, () => {
        console.log(`🌐 HTTP Server running on http://localhost:${PORT}`);
        console.log(`🔗 MCP endpoint: http://localhost:${PORT}/mcp`);
        console.log(`💚 MCP health check: http://localhost:${PORT}/mcp/health`);
        console.log(`📊 App health check: http://localhost:${PORT}/health`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// グレースフルシャットダウン
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();