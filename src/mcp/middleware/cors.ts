/**
 * CORS 設定ミドルウェア
 */

import cors from 'cors';

const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://claude.ai',
    // 開発環境では任意のlocalhost ポートを許可
    ...(process.env.NODE_ENV === 'development' ? [/http:\/\/localhost:\d+/] : [])
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  exposedHeaders: ['Content-Length', 'Content-Range'],
  maxAge: 86400 // 24 hours
};

export const corsMiddleware = cors(corsOptions);