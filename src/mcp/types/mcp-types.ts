/**
 * MCP サーバー関連の型定義
 */

export interface MCPServerConfig {
  name: string;
  version: string;
  port?: number;
  environment: 'development' | 'production' | 'test';
}

export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    uri?: string;
  }>;
  isError?: boolean;
}

export interface UserContext {
  id: number;
  username: string;
  roles: string[];
}

export interface TicketToolArguments {
  ticket_id?: number;
  seats?: number;
  reservation_id?: number;
  title?: string;
  max_price?: number;
  min_available_seats?: number;
  limit?: number;
}