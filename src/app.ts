import express from 'express';
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

const app = express();
const PORT = process.env.PORT || 3000;
const MCP_ENABLED = process.env.MCP_ENABLED === 'true';

// MCP サーバーインスタンス
let mcpServer: Server | null = null;
let mcpTransport: StreamableHTTPServerTransport | null = null;

// セキュリティヘッダー
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS設定（MCPが有効な場合）
if (MCP_ENABLED) {
  app.use(cors({
    origin: [
      'https://claude.ai',
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^http:\/\/\[::1\]:\d+$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id']
  }));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'default-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use('/auth', authRoutes);
app.use('/api', ticketRoutes);

// MCP エンドポイント（MCPが有効な場合）
if (MCP_ENABLED && mcpTransport) {
  app.post('/mcp', async (req, res) => {
    try {
      await mcpTransport!.handleRequest(req, res, req.body);
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
}

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// MCP サーバー初期化
const initializeMCPServer = async (): Promise<void> => {
  if (!MCP_ENABLED) return;

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
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      if (MCP_ENABLED) {
        console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
        console.log(`MCP health check: http://localhost:${PORT}/mcp/health`);
      }
    });
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