/**
 * MCP エンドポイント
 */

import { Router, Request, Response } from 'express';
import { MCPTicketServer } from '../http-server.js';
import { asyncWrapper } from '../middleware/error-handler.js';

const router = Router();

// MCP サーバーインスタンス（シングルトン）
let mcpServerInstance: MCPTicketServer | null = null;

const getMCPServer = (): MCPTicketServer => {
  if (!mcpServerInstance) {
    mcpServerInstance = new MCPTicketServer();
  }
  return mcpServerInstance;
};

/**
 * MCP リクエストハンドリング
 */
router.post('/mcp', asyncWrapper(async (req: Request, res: Response) => {
  const mcpServer = getMCPServer();
  
  // リクエストボディから MCP メッセージを取得
  const mcpRequest = req.body;
  
  if (!mcpRequest || !mcpRequest.method) {
    return res.status(400).json({
      error: {
        code: -32600,
        message: 'Invalid Request'
      }
    });
  }

  try {
    // MCP サーバーでリクエストを処理
    const result = await mcpServer.handleHttpRequest(mcpRequest);
    
    res.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    res.status(500).json({
      error: {
        code: -32603,
        message: 'Internal error',
        data: errorMessage
      },
      id: mcpRequest.id || null,
      jsonrpc: '2.0'
    });
  }
}));

/**
 * ヘルスチェックエンドポイント
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'MCP Ticket Server'
  });
});

/**
 * MCP サーバー情報エンドポイント
 */
router.get('/info', (req: Request, res: Response) => {
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

export default router;