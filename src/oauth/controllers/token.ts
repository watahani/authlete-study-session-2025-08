import { Request, Response } from 'express';
import { Authlete } from '@authlete/typescript-sdk';
import { TokenRequest } from '@authlete/typescript-sdk/models';
import { oauthLogger } from '../../utils/logger.js';

export class TokenController {
  constructor(private authlete: Authlete, private serviceId: string) {}

  async handleTokenRequest(req: Request, res: Response): Promise<void> {
    try {
      const parameters = new URLSearchParams(req.body).toString();
      
      const { clientId, clientSecret } = this.extractClientCredentials(req);

      const tokenRequest: TokenRequest = {
        parameters,
        clientId,
        clientSecret
      };

      const response = await this.authlete.token.process({
        serviceId: this.serviceId,
        tokenRequest
      });

      // デバッグログ: authorizationDetailsの確認
      if (response.authorizationDetails) {
        oauthLogger.debug('Authorization details in token response', {
          authorizationDetails: response.authorizationDetails,
          subject: response.subject,
          clientId: response.clientId
        });
      }

      switch (response.action) {
        case 'INTERNAL_SERVER_ERROR':
          res.status(500).json({
            error: 'server_error',
            error_description: 'Internal server error occurred'
          });
          break;

        case 'INVALID_CLIENT':
          res.status(401).json({
            error: 'invalid_client',
            error_description: response.resultMessage || 'Client authentication failed'
          });
          break;

        case 'BAD_REQUEST':
          res.status(400).json({
            error: 'invalid_request',
            error_description: response.resultMessage || 'Bad request'
          });
          break;

        case 'PASSWORD':
          res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: 'Resource Owner Password Credentials Grant is not supported'
          });
          break;

        case 'OK':
          if (response.responseContent) {
            res.setHeader('Content-Type', 'application/json; charset=UTF-8');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Pragma', 'no-cache');
            res.send(response.responseContent);
          } else {
            res.status(500).json({
              error: 'server_error',
              error_description: 'No token response content provided'
            });
          }
          break;

        case 'TOKEN_EXCHANGE':
          if (response.responseContent) {
            res.setHeader('Content-Type', 'application/json; charset=UTF-8');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Pragma', 'no-cache');
            res.send(response.responseContent);
          } else {
            res.status(500).json({
              error: 'server_error',
              error_description: 'No token exchange response content provided'
            });
          }
          break;

        case 'JWT_BEARER':
          if (response.responseContent) {
            res.setHeader('Content-Type', 'application/json; charset=UTF-8');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Pragma', 'no-cache');
            res.send(response.responseContent);
          } else {
            res.status(500).json({
              error: 'server_error',
              error_description: 'No JWT Bearer response content provided'
            });
          }
          break;

        default:
          res.status(500).json({
            error: 'server_error',
            error_description: `Unsupported action: ${response.action}`
          });
      }
    } catch (error) {
      oauthLogger.error('Token endpoint error', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error occurred'
      });
    }
  }

  private extractClientCredentials(req: Request): { clientId?: string; clientSecret?: string } {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Basic ')) {
      try {
        const base64Credentials = authHeader.slice(6);
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
        const [clientId, clientSecret] = credentials.split(':');
        return { clientId, clientSecret };
      } catch (error) {
        oauthLogger.error('Failed to parse Basic Auth credentials', error);
      }
    }

    return {
      clientId: req.body.client_id,
      clientSecret: req.body.client_secret
    };
  }
}
