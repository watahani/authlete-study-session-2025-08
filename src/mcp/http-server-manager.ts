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
import { ToolResult, UserContext } from './types/mcp-types.js';
import { TicketTools } from './tools/ticket-tools.js';
import { mcpLogger } from '../utils/logger.js';

export class MCPServerManager {
  private mcpServer: Server | null = null;
  private mcpTransport: StreamableHTTPServerTransport | null = null;

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