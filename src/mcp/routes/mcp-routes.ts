import { Request, Response, NextFunction, Router } from 'express';
import { MCPServerManager } from '../http-server-manager.js';
import { mcpLogger } from '../../utils/logger.js';

export interface MCPRoutesOptions {
  mcpServerManager: MCPServerManager;
  oauthEnabled: boolean;
  httpsEnabled: boolean;
  oauthMiddleware?: (req: Request, res: Response, next: NextFunction) => void;
}

export function createMCPRoutes(options: MCPRoutesOptions): Router {
  const { mcpServerManager, oauthEnabled, oauthMiddleware } = options;
  const router = Router();

  // MCP OAuth認可ミドルウェアの条件付き適用
  const getMcpMiddleware = () => {
    mcpLogger.debug('MCP OAuth decision', {
      enabled: oauthEnabled
    });
    
    return oauthEnabled && oauthMiddleware ? [oauthMiddleware] : [];
  };

  // MCP エンドポイント
  router.post('/mcp', 
    (req: Request, res: Response, next: NextFunction) => {
      // 実行時にOAuth設定を再評価してミドルウェアを適用
      const middleware = getMcpMiddleware();
      if (middleware.length === 0) {
        // OAuth無効の場合は直接次の処理に進む
        next();
      } else {
        // OAuth有効の場合は認証ミドルウェアを実行
        middleware[0](req, res, next);
      }
    },
    async (req: Request, res: Response) => {
      try {
        const transport = mcpServerManager.getTransport();
        if (!transport) {
          return res.status(503).json({
            error: {
              code: -32603,
              message: 'MCP server not initialized',
              data: 'Server is starting up'
            }
          });
        }
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        mcpLogger.error('MCP request handling failed', error);
        res.status(500).json({
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }
  );

  // MCP ヘルスチェック
  router.get('/mcp/health', (_req: Request, res: Response) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'MCP Ticket Server'
    });
  });

  // MCP サーバー情報
  router.get('/mcp/info', (_req: Request, res: Response) => {
    const serverInfo = mcpServerManager.getServerInfo();
    res.json({
      ...serverInfo,
      endpoints: {
        mcp: '/mcp',
        health: '/mcp/health',
        info: '/mcp/info'
      },
      oauth: {
        enabled: oauthEnabled,
        requiredScopes: oauthEnabled ? ['mcp:tickets:read'] : null
      }
    });
  });

  return router;
}