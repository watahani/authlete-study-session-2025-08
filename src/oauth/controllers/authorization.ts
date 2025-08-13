import { Request, Response } from 'express';
import { AuthleteClient } from '../authlete/client.js';
import { AuthorizationRequest } from '../authlete/types/index.js';

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
      console.error('Authorization endpoint error:', error);
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

    // セッションにOAuth情報を保存
    req.session.oauthTicket = response.ticket;
    req.session.oauthClient = response.client;
    req.session.oauthScopes = response.scopes;

    // セッション保存を確実に行う
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        res.status(500).json({
          error: 'server_error',
          error_description: 'Session management failed'
        });
        return;
      }

      if (req.user) {
        res.redirect(`/oauth/authorize/consent?ticket=${response.ticket}`);
      } else {
        res.redirect(`/auth/login?ticket=${response.ticket}&return_to=${encodeURIComponent(req.originalUrl)}`);
      }
    });
  }
}