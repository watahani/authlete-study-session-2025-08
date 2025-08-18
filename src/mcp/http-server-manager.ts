import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';

import { 
  listTicketsToolSchema,
  searchTicketsToolSchema,
  reserveTicketToolSchema,
  cancelReservationToolSchema,
  getUserReservationsToolSchema
} from './tools/types/tool-schemas.js';
import { ToolResult } from './types/mcp-types.js';
import { TicketTools } from './tools/ticket-tools.js';
import { mcpLogger } from '../utils/logger.js';
import { AuthenticatedRequest } from '../oauth/middleware/oauth-middleware.js';

export class MCPServerManager {
  private mcpServer: Server | null = null;
  private mcpTransport: StreamableHTTPServerTransport | null = null;
  private currentOAuthInfo: AuthenticatedRequest['oauth'] | undefined;

  async initialize(): Promise<void> {
    // MCP サーバー作成
    this.mcpServer = new Server(
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
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
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
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
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

    // トランスポート作成
    this.mcpTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    // サーバーとトランスポートを接続
    await this.mcpServer.connect(this.mcpTransport);

    mcpLogger.info('MCP HTTP Server initialized successfully');
  }

  private async handleToolCall(name: string, args: any): Promise<ToolResult> {
    mcpLogger.info(`MCPServerManager Tool called: ${name}`, { 
      args, 
      hasOauthInfo: !!this.currentOAuthInfo,
      subject: this.currentOAuthInfo?.subject,
      scopes: this.currentOAuthInfo?.scopes 
    });

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
    return TicketTools.listTickets(args, this.currentOAuthInfo);
  }

  private async handleSearchTickets(args: any): Promise<ToolResult> {
    return TicketTools.searchTickets(args, this.currentOAuthInfo);
  }

  private async handleReserveTicket(args: any): Promise<ToolResult> {
    // 書き込みスコープの確認
    if (!this.currentOAuthInfo?.scopes.includes('mcp:tickets:write')) {
      return {
        content: [
          {
            type: "text",
            text: "Unauthorized"
          }
        ],
        isError: true
      };
    }

    return TicketTools.reserveTicket(args, this.currentOAuthInfo);
  }

  private async handleCancelReservation(args: any): Promise<ToolResult> {
    // 書き込みスコープの確認
    if (!this.currentOAuthInfo?.scopes.includes('mcp:tickets:write')) {
      return {
        content: [
          {
            type: "text",
            text: "Unauthorized"
          }
        ],
        isError: true
      };
    }

    return TicketTools.cancelReservation(args, this.currentOAuthInfo);
  }

  private async handleGetUserReservations(args: any): Promise<ToolResult> {
    return TicketTools.getUserReservations(args, this.currentOAuthInfo);
  }


  setOAuthInfo(oauthInfo: AuthenticatedRequest['oauth'] | undefined): void {
    this.currentOAuthInfo = oauthInfo;
  }

  getTransport(): StreamableHTTPServerTransport | null {
    return this.mcpTransport;
  }

  getServerInfo() {
    return {
      name: 'authlete-study-session-mcp-server',
      version: '1.0.0',
      capabilities: {
        tools: {
          listChanged: false
        }
      }
    };
  }
}