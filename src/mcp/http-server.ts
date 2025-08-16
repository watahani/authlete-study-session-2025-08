/**
 * HTTP サーバーラッパー
 */

import express, { Request, Response } from 'express';
import helmet from 'helmet';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

import { mcpConfig, serverCapabilities } from './config/mcp-config.js';
import { ToolResult, UserContext } from './types/mcp-types.js';
import { TicketTools } from './tools/ticket-tools.js';
import { 
  listTicketsToolSchema,
  searchTicketsToolSchema,
  reserveTicketToolSchema,
  cancelReservationToolSchema,
  getUserReservationsToolSchema
} from './tools/types/tool-schemas.js';

import { corsMiddleware } from './middleware/cors.js';
import { loggingMiddleware, logger } from './middleware/logging.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export class MCPTicketServer {
  private server: Server;
  private app: express.Application;
  private transport: StreamableHTTPServerTransport;

  constructor() {
    this.server = new Server(
      {
        name: mcpConfig.name,
        version: mcpConfig.version
      },
      {
        capabilities: serverCapabilities
      }
    );

    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    this.app = express();
    this.setupServer();
    this.setupMCPHandlers();
  }

  private setupServer(): void {
    // セキュリティヘッダー設定
    this.app.use(helmet({
      // contentSecurityPolicy: {
      //   directives: {
      //     defaultSrc: ["'self'"],
      //     styleSrc: ["'self'", "'unsafe-inline'"],
      //     scriptSrc: ["'self'"],
      //     connectSrc: ["'self'", "https:"],
      //     imgSrc: ["'self'", "data:", "https:"],
      //   },
      // },
      crossOriginEmbedderPolicy: false
    }));

    // CORS 設定
    this.app.use(corsMiddleware);

    // ログミドルウェア
    this.app.use(loggingMiddleware);

    // JSON パーサー
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // MCP エンドポイント
    this.app.post('/mcp', this.handleMCPRequest.bind(this));

    // ヘルスチェックエンドポイント
    this.app.get('/health', (_req: Request, res: Response) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'MCP Ticket Server'
      });
    });

    // MCP サーバー情報エンドポイント
    this.app.get('/info', (_req: Request, res: Response) => {
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
          health: '/health',
          info: '/info'
        }
      });
    });

    // エラーハンドリング
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  private setupMCPHandlers(): void {
    // ツール一覧を返すハンドラ
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
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

    // ツール実行のハンドラ
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        const result = await this.handleToolCall(name, args || {});
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
  }

  private async handleToolCall(name: string, args: any): Promise<ToolResult> {
    logger.info(`Tool called: ${name}`, { args });

    switch (name) {
      case "list_tickets":
        return this.handleListTickets(args);
      
      case "search_tickets":
        return this.handleSearchTickets(args);
        
      case "reserve_ticket":
        return this.handleReserveTicket(args);
        
      case "cancel_reservation":
        return this.handleCancelReservation(args);
        
      case "get_user_reservations":
        return this.handleGetUserReservations(args);
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async handleListTickets(args: any): Promise<ToolResult> {
    // TODO: ユーザーコンテキストの取得を実装
    const userContext: UserContext | undefined = undefined;
    return TicketTools.listTickets(args, userContext);
  }

  private async handleSearchTickets(args: any): Promise<ToolResult> {
    // TODO: ユーザーコンテキストの取得を実装
    const userContext: UserContext | undefined = undefined;
    return TicketTools.searchTickets(args, userContext);
  }

  private async handleReserveTicket(args: any): Promise<ToolResult> {
    // TODO: ユーザーコンテキストの取得を実装（予約には認証が必要）
    const userContext: UserContext | undefined = undefined;
    return TicketTools.reserveTicket(args, userContext);
  }

  private async handleCancelReservation(args: any): Promise<ToolResult> {
    // TODO: ユーザーコンテキストの取得を実装（キャンセルには認証が必要）
    const userContext: UserContext | undefined = undefined;
    return TicketTools.cancelReservation(args, userContext);
  }

  private async handleGetUserReservations(args: any): Promise<ToolResult> {
    // TODO: ユーザーコンテキストの取得を実装（履歴取得には認証が必要）
    const userContext: UserContext | undefined = undefined;
    return TicketTools.getUserReservations(args, userContext);
  }

  /**
   * MCP HTTP リクエストハンドラー
   */
  private async handleMCPRequest(req: Request, res: Response): Promise<void> {
    try {
      await this.transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('MCP request handling failed:', error);
      res.status(500).json({
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * HTTP サーバーを起動
   */
  async startHttpServer(): Promise<void> {
    const port = mcpConfig.port || 3001;
    
    // MCP サーバーとトランスポートを接続
    await this.server.connect(this.transport);
    
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        logger.info(`MCP HTTP Server running on port ${port}`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`Server info: http://localhost:${port}/info`);
        logger.info(`MCP endpoint: http://localhost:${port}/mcp`);
        resolve();
      });
    });
  }
}