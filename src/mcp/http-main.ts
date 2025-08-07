#!/usr/bin/env node

/**
 * MCP HTTP サーバーの起動スクリプト
 */

import { MCPTicketServer } from './http-server.js';
import { logger } from './middleware/logging.js';

async function main() {
  try {
    const server = new MCPTicketServer();
    await server.startHttpServer();
    
    logger.info('MCP HTTP Server started successfully');
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start MCP HTTP Server:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}