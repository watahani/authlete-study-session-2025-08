import { Request, Response } from 'express';
import { Authlete } from '@authlete/typescript-sdk';
import { AuthorizationRequest, AuthorizationResponse } from '@authlete/typescript-sdk/models';
import { oauthLogger } from '../../utils/logger.js';

export class AuthorizationController {
  constructor(private authlete: Authlete, private serviceId: string) {}

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

      const response = await this.authlete.authorization.processRequest({
        serviceId: this.serviceId,
        authorizationRequest
      });

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

  private async handleNoInteraction(_req: Request, res: Response, _response: any): Promise<void> {
    res.status(400).json({
      error: 'interaction_required',
      error_description: 'User interaction is required'
    });
  }

  private async handleInteraction(req: Request, res: Response, response: AuthorizationResponse): Promise<void> {
    if (!response.ticket) {
      res.status(500).json({
        error: 'server_error',
        error_description: 'No ticket provided for interaction'
      });
      return;
    }

    oauthLogger.debug('Authlete response debug', response);
    oauthLogger.debug('here');

    // セッション情報の保存前デバッグ
    oauthLogger.debug('Before session save', {
      sessionId: req.session.id,
      hasUser: !!req.user,
      ticket: response.ticket
    });
    
    // WORKAROUND: Authlete authorization レスポンスにauthorizationDetailsTypesが含まれないため、
    // 別途 client/get API を呼び出してクライアント詳細を取得する
    let clientWithAuthDetails = response.client;
    if (response.client?.clientId) {
      try {
        const clientDetails = await this.authlete.client.get({
          serviceId: this.serviceId,
          clientId: response.client.clientId.toString()
        });
        
        oauthLogger.debug('Client details from client/get API', {
          clientId: response.client.clientId,
          hasAuthorizationDetailsTypes: !!clientDetails.authorizationDetailsTypes,
          authorizationDetailsTypes: clientDetails.authorizationDetailsTypes
        });

        // クライアント情報にauthorizationDetailsTypesを追加
        if (clientDetails.authorizationDetailsTypes) {
          clientWithAuthDetails = {
            ...response.client,
            authorizationDetailsTypes: clientDetails.authorizationDetailsTypes
          };
        }
      } catch (error) {
        oauthLogger.warn('Failed to fetch client details for authorizationDetailsTypes', {
          clientId: response.client.clientId,
          error: error
        });
      }
    }

    // セッションにOAuth情報を保存
    req.session.oauthTicket = response.ticket;
    req.session.oauthClient = clientWithAuthDetails;
    req.session.oauthScopes = Array.isArray(response.scopes) ? response.scopes : [];

    // 保存直後の確認
    oauthLogger.debug('After assignment - Session OAuth data', {
      oauthTicket: req.session.oauthTicket,
      oauthClient: !!req.session.oauthClient,
      oauthScopes: !!req.session.oauthScopes,
      clientAuthDetailsTypes: req.session.oauthClient?.authorizationDetailsTypes
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
