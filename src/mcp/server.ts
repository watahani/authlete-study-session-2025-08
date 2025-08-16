#!/usr/bin/env node

/**
 * MCP サーバーのメインファイル
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { mcpLogger } from '../utils/logger.js';
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

class MCPTicketServer {
  private server: Server;

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

    this.setupHandlers();
  }

  private setupHandlers(): void {
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
    mcpLogger.debug(`Tool called: ${name}`, { args });

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

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    mcpLogger.info(`${mcpConfig.name} running on stdio`);
  }
}

// メイン実行
async function main() {
  const server = new MCPTicketServer();
  
  try {
    await server.run();
  } catch (error) {
    mcpLogger.error('Fatal error', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}