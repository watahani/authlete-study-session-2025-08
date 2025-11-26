import { Request, Response } from 'express';
import { Authlete } from '@authlete/typescript-sdk';
import { oauthLogger } from '../../utils/logger.js';

/**
 * Dynamic Client Registration (DCR) コントローラー
 * RFC 7591 OAuth 2.0 Dynamic Client Registration Protocol に準拠
 * RFC 7592 OAuth 2.0 Dynamic Client Registration Management Protocol に準拠
 */
export class DCRController {
  constructor(private authlete: Authlete, private serviceId: string) {}

  /**
   * クライアント登録エンドポイント (POST /register)
   * RFC 7591 Section 3.1
   */
  public async handleClientRegistration(req: Request, res: Response): Promise<void> {
    try {
      oauthLogger.debug('DCR client registration request', {
        method: req.method,
        url: req.url,
        contentType: req.headers['content-type'],
        hasBody: !!req.body
      });

      // Content-Type の検証
      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        res.status(400).json({
          error: 'invalid_client_metadata',
          error_description: 'Content-Type must be application/json'
        });
        return;
      }

      // リクエストボディをJSON文字列として準備
      const clientMetadata = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      // クライアントメタデータを準備
      const enhancedClientMetadata = JSON.parse(clientMetadata);

      // mcp: プレフィクスを持つスコープが指定されている場合、MCPクライアントフラグを設定
      if (enhancedClientMetadata.scope) {
        const scopes = typeof enhancedClientMetadata.scope === 'string' 
          ? enhancedClientMetadata.scope.split(' ')
          : enhancedClientMetadata.scope;
        
        if (Array.isArray(scopes) && scopes.some(scope => scope.startsWith('mcp:'))) {
          enhancedClientMetadata.is_mcp_client = true;
          oauthLogger.debug('MCP client detected', {
            scopes: scopes,
            mcpScopes: scopes.filter(scope => scope.startsWith('mcp:'))
          });
        }
      }

      // Authlete DCR API を呼び出し
      const response = await this.authlete.dynamicClientRegistration.register({
        serviceId: this.serviceId,
        requestBody: {
          json: JSON.stringify(enhancedClientMetadata)
        }
      });

      oauthLogger.debug('Authlete DCR registration response', {
        action: response.action,
        resultCode: response.resultCode,
        resultMessage: response.resultMessage,
        hasClient: !!response.client
      });

      // Cache-Control と Pragma ヘッダーを設定
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');

      switch (response.action) {
        case 'CREATED':
          oauthLogger.info('Client successfully registered via DCR', {
            clientId: response.client?.clientIdAlias || response.client?.clientId,
            clientName: response.client?.clientName
          });

          var dcrResponse = response.responseContent ? JSON.parse(response.responseContent) : response.client;

          //remove client_secret from response if public client.
          //some MCP client may not respect token_endpoint_auth_method setting and expect no client_secret in response.
          if (dcrResponse.token_endpoint_auth_method === 'none') {
            delete dcrResponse.client_secret;
          }

          res.status(201).setHeader('Content-Type', 'application/json').send(dcrResponse);
          break;

        case 'BAD_REQUEST':
          oauthLogger.warn('DCR registration bad request', {
            resultCode: response.resultCode,
            resultMessage: response.resultMessage
          });
          res.status(400).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        case 'INTERNAL_SERVER_ERROR':
          oauthLogger.error('DCR registration internal server error', {
            resultCode: response.resultCode,
            resultMessage: response.resultMessage
          });
          res.status(500).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        default:
          oauthLogger.error('Unexpected DCR registration response action', {
            action: response.action,
            resultCode: response.resultCode,
            resultMessage: response.resultMessage
          });
          res.status(500).json({
            error: 'server_error',
            error_description: 'Unexpected server response'
          });
      }
    } catch (error) {
      oauthLogger.error('DCR registration error', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during client registration'
      });
    }
  }

  /**
   * クライアント情報取得エンドポイント (GET /register/:client_id)
   * RFC 7592 Section 2
   */
  public async handleClientGet(req: Request, res: Response): Promise<void> {
    try {
      const clientId = req.params.client_id;
      const authorizationHeader = req.headers.authorization;

      oauthLogger.debug('DCR client get request', {
        clientId,
        hasAuthHeader: !!authorizationHeader
      });

      // Bearer トークンの抽出
      let registrationAccessToken: string | undefined;
      if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
        registrationAccessToken = authorizationHeader.substring(7);
      }

      if (!registrationAccessToken) {
        res.status(401).json({
          error: 'invalid_token',
          error_description: 'Registration access token is required'
        });
        return;
      }

      // Authlete DCR Get API を呼び出し
      const response = await this.authlete.dynamicClientRegistration.get({
        serviceId: this.serviceId,
        requestBody: {
          token: registrationAccessToken,
          clientId: clientId
        }
      });

      oauthLogger.debug('Authlete DCR get response', {
        action: response.action,
        resultCode: response.resultCode,
        resultMessage: response.resultMessage
      });

      // Cache-Control と Pragma ヘッダーを設定
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');

      switch (response.action) {
        case 'OK':
          res.status(200).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        case 'UNAUTHORIZED':
          res.status(401).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        case 'BAD_REQUEST':
          res.status(400).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        case 'INTERNAL_SERVER_ERROR':
          res.status(500).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        default:
          oauthLogger.error('Unexpected DCR get response action', {
            action: response.action,
            resultCode: response.resultCode,
            resultMessage: response.resultMessage
          });
          res.status(500).json({
            error: 'server_error',
            error_description: 'Unexpected server response'
          });
      }
    } catch (error) {
      oauthLogger.error('DCR get error', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during client retrieval'
      });
    }
  }

  /**
   * クライアント情報更新エンドポイント (PUT /register/:client_id)
   * RFC 7592 Section 2
   */
  public async handleClientUpdate(req: Request, res: Response): Promise<void> {
    try {
      const clientId = req.params.client_id;
      const authorizationHeader = req.headers.authorization;

      oauthLogger.debug('DCR client update request', {
        clientId,
        hasAuthHeader: !!authorizationHeader,
        contentType: req.headers['content-type']
      });

      // Content-Type の検証
      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        res.status(400).json({
          error: 'invalid_client_metadata',
          error_description: 'Content-Type must be application/json'
        });
        return;
      }

      // Bearer トークンの抽出
      let registrationAccessToken: string | undefined;
      if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
        registrationAccessToken = authorizationHeader.substring(7);
      }

      if (!registrationAccessToken) {
        res.status(401).json({
          error: 'invalid_token',
          error_description: 'Registration access token is required'
        });
        return;
      }

      // リクエストボディをJSON文字列として準備
      const clientMetadata = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

      // クライアントメタデータを準備
      const enhancedClientMetadata = JSON.parse(clientMetadata);

      // mcp: プレフィクスを持つスコープが指定されている場合、MCPクライアントフラグを設定
      if (enhancedClientMetadata.scope) {
        const scopes = typeof enhancedClientMetadata.scope === 'string' 
          ? enhancedClientMetadata.scope.split(' ')
          : enhancedClientMetadata.scope;
        
        if (Array.isArray(scopes) && scopes.some(scope => scope.startsWith('mcp:'))) {
          enhancedClientMetadata.is_mcp_client = true;
          oauthLogger.debug('MCP client detected in update', {
            clientId: clientId,
            scopes: scopes,
            mcpScopes: scopes.filter(scope => scope.startsWith('mcp:'))
          });
        }
      }

      oauthLogger.debug('DCR update request payload', {
        clientId,
        token: registrationAccessToken ? 'present' : 'missing',
        originalMetadata: clientMetadata,
        enhancedMetadata: JSON.stringify(enhancedClientMetadata)
      });

      // Authlete DCR Update API を呼び出し
      const response = await this.authlete.dynamicClientRegistration.update({
        serviceId: this.serviceId,
        requestBody: {
          token: registrationAccessToken,
          clientId: clientId,
          json: JSON.stringify(enhancedClientMetadata)
        }
      });

      oauthLogger.debug('Authlete DCR update response', {
        action: response.action,
        resultCode: response.resultCode,
        resultMessage: response.resultMessage
      });

      // Cache-Control と Pragma ヘッダーを設定
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');

      switch (response.action) {
        case 'UPDATED':
          oauthLogger.info('Client successfully updated via DCR', {
            clientId: clientId
          });
          res.status(200).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        case 'UNAUTHORIZED':
          res.status(401).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        case 'BAD_REQUEST':
          res.status(400).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        case 'INTERNAL_SERVER_ERROR':
          res.status(500).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        default:
          oauthLogger.error('Unexpected DCR update response action', {
            action: response.action,
            resultCode: response.resultCode,
            resultMessage: response.resultMessage
          });
          res.status(500).json({
            error: 'server_error',
            error_description: 'Unexpected server response'
          });
      }
    } catch (error) {
      oauthLogger.error('DCR update error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        clientId: req.params.client_id,
        authHeader: req.headers.authorization ? 'present' : 'missing'
      });
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during client update'
      });
    }
  }

  /**
   * クライアント削除エンドポイント (DELETE /register/:client_id)
   * RFC 7592 Section 2
   */
  public async handleClientDelete(req: Request, res: Response): Promise<void> {
    try {
      const clientId = req.params.client_id;
      const authorizationHeader = req.headers.authorization;

      oauthLogger.debug('DCR client delete request', {
        clientId,
        hasAuthHeader: !!authorizationHeader
      });

      // Bearer トークンの抽出
      let registrationAccessToken: string | undefined;
      if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
        registrationAccessToken = authorizationHeader.substring(7);
      }

      if (!registrationAccessToken) {
        res.status(401).json({
          error: 'invalid_token',
          error_description: 'Registration access token is required'
        });
        return;
      }

      // Authlete DCR Delete API を呼び出し
      const response = await this.authlete.dynamicClientRegistration.delete({
        serviceId: this.serviceId,
        requestBody: {
          token: registrationAccessToken,
          clientId: clientId
        }
      });

      oauthLogger.debug('Authlete DCR delete response', {
        action: response.action,
        resultCode: response.resultCode,
        resultMessage: response.resultMessage
      });

      // Cache-Control と Pragma ヘッダーを設定
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');

      switch (response.action) {
        case 'DELETED':
          oauthLogger.info('Client successfully deleted via DCR', {
            clientId: clientId
          });
          res.status(204).send(); // No Content
          break;

        case 'UNAUTHORIZED':
          res.status(401).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        case 'BAD_REQUEST':
          res.status(400).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        case 'INTERNAL_SERVER_ERROR':
          res.status(500).setHeader('Content-Type', 'application/json').send(response.responseContent);
          break;

        default:
          oauthLogger.error('Unexpected DCR delete response action', {
            action: response.action,
            resultCode: response.resultCode,
            resultMessage: response.resultMessage
          });
          res.status(500).json({
            error: 'server_error',
            error_description: 'Unexpected server response'
          });
      }
    } catch (error) {
      oauthLogger.error('DCR delete error', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during client deletion'
      });
    }
  }
}
