import { Request, Response } from 'express';
import { AuthleteClient } from '../authlete/client.js';
import { AuthorizationRequest } from '../authlete/types/index.js';
import { oauthLogger } from '../../utils/logger.js';

export class AuthorizationController {
  private authleteClient: AuthleteClient;

  constructor(authleteClient: AuthleteClient) {
    this.authleteClient = authleteClient;
  }

  async handleAuthorizationRequest(req: Request, res: Response): Promise<void> {
    try {
      let parameters: string;
      
      if (req.method === 'GET') {
        parameters = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`).search.substring(1);
      } else {
        parameters = new URLSearchParams(req.body).toString();
      }

      const authorizationRequest: AuthorizationRequest = {
        parameters
      };

      const response = await this.authleteClient.authorize(authorizationRequest);

      switch (response.action) {
        case 'INTERNAL_SERVER_ERROR':
          res.status(500).json({
            error: 'server_error',
            error_description: 'Internal server error occurred'
          });
          break;

        case 'BAD_REQUEST':
          res.status(400).json({
            error: 'invalid_request',
            error_description: response.resultMessage || 'Bad request'
          });
          break;

        case 'LOCATION':
          if (response.responseContent) {
            res.redirect(response.responseContent);
          } else {
            res.status(500).json({
              error: 'server_error',
              error_description: 'No redirect location provided'
            });
          }
          break;

        case 'FORM':
          if (response.responseContent) {
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.send(response.responseContent);
          } else {
            res.status(500).json({
              error: 'server_error',
              error_description: 'No form content provided'
            });
          }
          break;

        case 'NO_INTERACTION':
          await this.handleNoInteraction(req, res, response);
          break;

        case 'INTERACTION':
          await this.handleInteraction(req, res, response);
          break;

        default:
          res.status(500).json({
            error: 'server_error',
            error_description: `Unsupported action: ${response.action}`
          });
      }
    } catch (error) {
      oauthLogger.error('Authorization endpoint error', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error occurred'
      });
    }
  }

  private async handleNoInteraction(req: Request, res: Response, response: any): Promise<void> {
    res.status(400).json({
      error: 'interaction_required',
      error_description: 'User interaction is required'
    });
  }

  private async handleInteraction(req: Request, res: Response, response: any): Promise<void> {
    if (!response.ticket) {
      res.status(500).json({
        error: 'server_error',
        error_description: 'No ticket provided for interaction'
      });
      return;
    }

    oauthLogger.debug('Authlete response debug', response);


    // デバッグ: Authleteレスポンスの内容をログ出力
    oauthLogger.debug('Authlete response debug', {
      action: response.action,
      ticket: !!response.ticket,
      client: !!response.client,
      scopes: response.scopes,
      scopesType: typeof response.scopes,
      scopesIsArray: Array.isArray(response.scopes),
      scopesLength: response.scopes?.length,
      scopesDetail: response.scopes
    });

    // セッション情報の保存前デバッグ
    oauthLogger.debug('Before session save', {
      sessionId: req.session.id,
      hasUser: !!req.user,
      ticket: response.ticket
    });
    
    // セッションにOAuth情報を保存
    req.session.oauthTicket = response.ticket;
    req.session.oauthClient = response.client;
    req.session.oauthScopes = Array.isArray(response.scopes) ? response.scopes : [];

    // 保存直後の確認
    oauthLogger.debug('After assignment - Session OAuth data', {
      oauthTicket: req.session.oauthTicket,
      oauthClient: !!req.session.oauthClient,
      oauthScopes: !!req.session.oauthScopes
    });

    // セッション保存を確実に行う
    req.session.save((err) => {
      if (err) {
        oauthLogger.error('Session save error', err);
        res.status(500).json({
          error: 'server_error',
          error_description: 'Session management failed'
        });
        return;
      }
      
      oauthLogger.debug('Session saved successfully - redirecting...', {
        sessionId: req.session.id
      });

      if (req.user) {
        oauthLogger.debug('User authenticated, redirecting to consent');
        res.redirect('/oauth/authorize/consent');
      } else {
        oauthLogger.debug('User not authenticated, redirecting to login');
        res.redirect(`/auth/login?return_to=${encodeURIComponent('/oauth/authorize/consent')}`);
      }
    });
  }
}