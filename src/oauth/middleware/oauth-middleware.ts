import { Request, Response, NextFunction } from 'express';
import { AuthleteClient, createAuthleteClient } from '../authlete/client.js';
import { getAuthleteConfig } from '../config/authlete-config.js';
import { IntrospectionRequest } from '../authlete/types/index.js';
import { oauthLogger } from '../../utils/logger.js';

interface OAuthValidationOptions {
  requiredScopes?: string[];
  requireSSL?: boolean;
  // OAuth 2.1ではheaderのみ許可
}

interface AuthenticatedRequest extends Request {
  oauth?: {
    token: string;
    subject: string;
    clientId: string;
    scopes: string[];
    username?: string;
    exp?: number;
  };
}

/**
 * OAuth Bearer Token認証ミドルウェア
 * Authlete Introspection APIを使用してアクセストークンを検証
 */
export const oauthAuthentication = (options: OAuthValidationOptions = {}) => {
  const {
    requiredScopes = [],
    requireSSL = true
  } = options;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // HTTPS必須チェック
      if (requireSSL && req.protocol !== 'https') {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'HTTPS is required for OAuth protected resources'
        });
      }

      // Bearer tokenの抽出（OAuth 2.1ではheaderのみ）
      const token = extractBearerToken(req);
      
      if (!token) {
        // RFC 6750 Section 3: WWW-Authenticate ヘッダーを設定
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const wwwAuth = `Bearer realm="${baseUrl}", ` +
                       `error="invalid_request", ` +
                       `error_description="Access token is required", ` +
                       `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/mcp"`;
        
        res.set('WWW-Authenticate', wwwAuth);
        return res.status(401).json({
          error: 'invalid_request',
          error_description: 'Access token is required'
        });
      }

      // Authlete Introspection APIでトークンを検証
      const authleteConfig = getAuthleteConfig();
      const client = createAuthleteClient(authleteConfig);
      const introspectionRequest: IntrospectionRequest = {
        token,
        scopes: requiredScopes
      };

      const introspectionResponse = await client.introspect(introspectionRequest);
      
      // デバッグログ: Introspection レスポンスを出力
      oauthLogger.debug('Authlete introspection response', introspectionResponse);
      
      // baseUrl を事前に定義
      const baseUrl = `${req.protocol}://${req.get('host')}`;

      // Introspection結果の処理
      switch (introspectionResponse.action) {
        case 'INTERNAL_SERVER_ERROR':
          oauthLogger.error('Authlete introspection error', { message: introspectionResponse.resultMessage });
          return res.status(500).json({
            error: 'server_error',
            error_description: 'Token validation failed'
          });

        case 'BAD_REQUEST':
          return res.status(400).json({
            error: 'invalid_request',
            error_description: introspectionResponse.resultMessage || 'Invalid token request'
          });

        case 'UNAUTHORIZED':
          const wwwAuthInvalid = `Bearer realm="${baseUrl}", ` +
                               `error="invalid_token", ` +
                               `error_description="The access token provided is expired, revoked, malformed, or invalid", ` +
                               `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`;
          
          res.set('WWW-Authenticate', wwwAuthInvalid);
          return res.status(401).json({
            error: 'invalid_token',
            error_description: 'The access token provided is expired, revoked, malformed, or invalid'
          });

        case 'FORBIDDEN':
          const wwwAuthScope = `Bearer realm="${baseUrl}", ` +
                             `error="insufficient_scope", ` +
                             `error_description="The request requires higher privileges than provided", ` +
                             `scope="${requiredScopes.join(' ')}", ` +
                             `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`;
          
          res.set('WWW-Authenticate', wwwAuthScope);
          return res.status(403).json({
            error: 'insufficient_scope',
            error_description: `The request requires higher privileges than provided. Required scopes: ${requiredScopes.join(', ')}`
          });

        case 'OK':
          // トークンが有効 - リクエストにOAuth情報を追加
          req.oauth = {
            token: token,
            subject: introspectionResponse.subject || '',
            clientId: introspectionResponse.clientId?.toString() || '',
            scopes: introspectionResponse.scopes || [],
            username: introspectionResponse.subject, // subject をユーザー識別子として使用
            exp: introspectionResponse.expiresAt
          };
          
          next();
          break;

        default:
          oauthLogger.error('Unexpected introspection action', { action: introspectionResponse.action });
          return res.status(500).json({
            error: 'server_error',
            error_description: 'Unexpected token validation result'
          });
      }
      
    } catch (error) {
      oauthLogger.error('OAuth authentication error', error);
      return res.status(500).json({
        error: 'server_error',
        error_description: 'Token validation failed'
      });
    }
  };
};

/**
 * Bearer tokenの抽出 (RFC 6750, OAuth 2.1 compliant)
 * OAuth 2.1では Authorization header のみ許可
 */
function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  // Authorization headerから抽出 (OAuth 2.1 only method)
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * スコープ検証ミドルウェア（既に認証済みのリクエスト用）
 */
export const requireScopes = (requiredScopes: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.oauth) {
      return res.status(401).json({
        error: 'invalid_token',
        error_description: 'No OAuth authentication found'
      });
    }

    const hasRequiredScopes = requiredScopes.every(scope => 
      req.oauth!.scopes.includes(scope)
    );

    if (!hasRequiredScopes) {
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: `Required scopes: ${requiredScopes.join(', ')}. Provided scopes: ${req.oauth.scopes.join(', ')}`
      });
    }

    next();
  };
};

export type { AuthenticatedRequest };