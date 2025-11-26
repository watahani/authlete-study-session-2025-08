import { Request, Response } from 'express';
import { Authlete } from '@authlete/typescript-sdk';
import { IntrospectionRequest } from '@authlete/typescript-sdk/models';
import { oauthLogger } from '../../utils/logger.js';

export class IntrospectionController {
  constructor(private authlete: Authlete, private serviceId: string) {}

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
      const introspectionRequest: IntrospectionRequest = {
        token
      };

      const introspectionResponse = await this.authlete.introspection.process({
        serviceId: this.serviceId,
        introspectionRequest
      });

      oauthLogger.debug('Authlete introspection response received', {
        action: introspectionResponse.action
      });

      const sendResponseContent = (status?: number) => {
        if (introspectionResponse.responseContent) {
          if (status) {
            res.status(status);
          }
          res.setHeader('Content-Type', 'application/json');
          res.send(introspectionResponse.responseContent);
        } else {
          res.status(status ?? 500).json({
            error: 'server_error',
            error_description: 'No introspection response content provided'
          });
        }
      };

      switch (introspectionResponse.action) {
        case 'OK':
          sendResponseContent();
          break;
        case 'BAD_REQUEST':
          sendResponseContent(400);
          break;
        case 'UNAUTHORIZED':
          sendResponseContent(401);
          break;
        case 'FORBIDDEN':
          sendResponseContent(403);
          break;
        case 'INTERNAL_SERVER_ERROR':
          sendResponseContent(500);
          break;
        default:
          oauthLogger.error('Unexpected introspection action', { action: introspectionResponse.action });
          sendResponseContent(500);
      }

    } catch (error) {
      oauthLogger.error('Introspection request failed', error);
      if (
        error instanceof Error
        && 'responseContent' in (error as any)
        && (error as any).responseContent
      ) {
        res.setHeader('Content-Type', 'application/json');
        res.send((error as any).responseContent);
      } else {
        res.status(500).json({
          error: 'server_error',
          error_description: 'Internal server error occurred during token introspection'
        });
      }
    }
  }
}
