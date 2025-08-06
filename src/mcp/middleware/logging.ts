/**
 * リクエストログミドルウェア
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('user-agent') || '';

  logger.info('Request received', {
    method,
    url,
    ip,
    userAgent
  });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    
    logger.info('Request completed', {
      method,
      url,
      statusCode,
      duration,
      ip
    });
  });

  next();
};

export { logger };