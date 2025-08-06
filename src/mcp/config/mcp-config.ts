/**
 * MCP サーバー設定
 */

import { MCPServerConfig } from '../types/mcp-types.js';

export const mcpConfig: MCPServerConfig = {
  name: "authlete-study-session-mcp-server",
  version: "1.0.0",
  port: parseInt(process.env.MCP_PORT || '3001'),
  environment: (process.env.NODE_ENV as MCPServerConfig['environment']) || 'development'
};

export const serverCapabilities = {
  tools: {
    listChanged: false  // デモ用なので動的なツール変更は行わない
  }
} as const;