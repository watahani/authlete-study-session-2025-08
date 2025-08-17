import { Request, Response } from 'express';
import { AuthleteClient } from '../authlete/client.js';
import { oauthLogger } from '../../utils/logger.js';

export class IntrospectionController {
  constructor(private authleteClient: AuthleteClient) {}

  async handleIntrospectionRequest(req: Request, res: Response): Promise<void> {
    try {
      oauthLogger.debug('Introspection request received', {
        method: req.method,
        headers: req.headers,
        body: req.body
      });

      const { token } = req.body;

      if (!token) {
        oauthLogger.warn('Missing token parameter in introspection request');
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing token parameter'
        });
        return;
      }

      oauthLogger.debug('Calling Authlete introspection API for token', {
        tokenPrefix: token.substring(0, 10) + '...'
      });

      // Authlete の Token Introspection API を呼び出し
      const introspectionResponse = await (this.authleteClient as any).makeRequest('/auth/introspection', {
        token: token
      });

      oauthLogger.debug('Authlete introspection response received', {
        action: introspectionResponse.action
      });

      if (introspectionResponse.action === 'OK') {
        // トークンが有効な場合
        const responseData = {
          active: true,
          scope: introspectionResponse.scopes?.join(' ') || '',
          client_id: introspectionResponse.clientId?.toString(),
          username: introspectionResponse.subject,
          token_type: 'Bearer',
          exp: introspectionResponse.expiresAt ? Math.floor(introspectionResponse.expiresAt / 1000) : undefined,
          iat: introspectionResponse.issuedAt ? Math.floor(introspectionResponse.issuedAt / 1000) : undefined,
          sub: introspectionResponse.subject,
          aud: introspectionResponse.clientId?.toString()
        };

        // undefined フィールドを除去
        Object.keys(responseData).forEach(key => {
          if (responseData[key as keyof typeof responseData] === undefined) {
            delete responseData[key as keyof typeof responseData];
          }
        });

        oauthLogger.debug('Returning successful introspection response', responseData);
        res.json(responseData);
      } else {
        // トークンが無効な場合
        oauthLogger.debug('Token is inactive or invalid');
        res.json({
          active: false
        });
      }

    } catch (error) {
      oauthLogger.error('Introspection request failed', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error occurred during token introspection'
      });
    }
  }
}