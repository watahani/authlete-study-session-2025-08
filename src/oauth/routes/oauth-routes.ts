import express from 'express';
import { AuthorizationController } from '../controllers/authorization.js';
import { TokenController } from '../controllers/token.js';
import { IntrospectionController } from '../controllers/introspection.js';
import { createAuthleteClient, AuthleteClient } from '../authlete/client.js';
import { getAuthleteConfig } from '../config/authlete-config.js';
import { oauthLogger } from '../../utils/logger.js';

const router = express.Router();

// 遅延初期化用の変数
let authleteClient: AuthleteClient | null = null;
let authorizationController: AuthorizationController | null = null;
let tokenController: TokenController | null = null;
let introspectionController: IntrospectionController | null = null;

// Authleteクライアントの遅延初期化
function getAuthleteClient(): AuthleteClient {
  if (!authleteClient) {
    const authleteConfig = getAuthleteConfig();
    authleteClient = createAuthleteClient(authleteConfig);
    authorizationController = new AuthorizationController(authleteClient);
    tokenController = new TokenController(authleteClient);
    introspectionController = new IntrospectionController(authleteClient);
  }
  return authleteClient;
}

function getAuthorizationController(): AuthorizationController {
  getAuthleteClient(); // 初期化を確実に行う
  return authorizationController!;
}

function getTokenController(): TokenController {
  getAuthleteClient(); // 初期化を確実に行う
  return tokenController!;
}

function getIntrospectionController(): IntrospectionController {
  getAuthleteClient(); // 初期化を確実に行う
  return introspectionController!;
}

router.get('/authorize', (req, res) => {
  getAuthorizationController().handleAuthorizationRequest(req, res);
});

router.post('/authorize', (req, res) => {
  getAuthorizationController().handleAuthorizationRequest(req, res);
});

router.post('/token', (req, res) => {
  getTokenController().handleTokenRequest(req, res);
});

router.post('/introspect', (req, res) => {
  getIntrospectionController().handleIntrospectionRequest(req, res);
});

router.get('/authorize/consent', (req, res) => {
  const { oauthTicket, oauthClient, oauthScopes } = req.session;
  
  // セッションデバッグ情報（ticketはURLから削除）
  oauthLogger.debug('Consent page session debug', {
    sessionId: req.session.id,
    sessionTicket: oauthTicket,
    hasClient: !!oauthClient,
    hasScopes: !!oauthScopes,
    user: !!req.user,
    allSessionKeys: Object.keys(req.session)
  });

  // セッション情報の検証
  if (!oauthTicket || !oauthClient || !oauthScopes) {
    oauthLogger.warn('Missing session data', { oauthTicket, oauthClient: !!oauthClient, oauthScopes: !!oauthScopes });
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing authorization session data'
    });
  }

  // ユーザー認証確認
  if (!req.user) {
    return res.redirect(`/auth/login?return_to=${encodeURIComponent(req.originalUrl)}`);
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>認可の同意</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .client-info { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .scopes { margin: 20px 0; }
        .scope { margin: 10px 0; padding: 10px; background: #f9f9f9; border-left: 3px solid #007bff; }
        .buttons { margin: 30px 0; }
        button { padding: 10px 20px; margin: 0 10px; border: none; border-radius: 5px; cursor: pointer; }
        .approve { background: #28a745; color: white; }
        .deny { background: #dc3545; color: white; }
      </style>
    </head>
    <body>
      <h1>アプリケーション認可</h1>
      
      <div class="client-info">
        <h3>アプリケーション情報</h3>
        <p><strong>名前:</strong> ${oauthClient.clientName || 'Unknown Application'}</p>
        <p><strong>クライアントID:</strong> ${oauthClient.clientIdAlias || oauthClient.clientId}</p>
      </div>

      <div class="scopes">
        <h3>要求されるアクセス権限</h3>
        ${oauthScopes.map(scope => `
          <div class="scope">
            <strong>${scope.name}</strong><br>
            <span>${scope.description}</span>
          </div>
        `).join('')}
      </div>

      <div class="buttons">
        <form action="/oauth/authorize/decision" method="post" style="display: inline;">
          <input type="hidden" name="authorized" value="true">
          <button type="submit" class="approve">許可する</button>
        </form>
        
        <form action="/oauth/authorize/decision" method="post" style="display: inline;">
          <input type="hidden" name="authorized" value="false">
          <button type="submit" class="deny">拒否する</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// テスト用コールバックエンドポイント
router.get('/callback', (req, res) => {
  oauthLogger.debug('OAuth callback received', {
    query: req.query,
    url: req.url
  });
  
  res.json({
    message: 'OAuth callback received',
    params: req.query
  });
});

router.post('/authorize/decision', async (req, res) => {
  oauthLogger.debug('Decision endpoint called', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    sessionId: req.session.id,
    userAuthenticated: !!req.user
  });
  
  try {
    const { authorized } = req.body;
    const user = req.user as any;
    const { oauthTicket, oauthClient, oauthScopes } = req.session;
    
    oauthLogger.debug('Decision processing', {
      authorized: authorized,
      hasUser: !!user,
      sessionData: {
        oauthTicket: !!oauthTicket,
        hasClient: !!oauthClient,
        hasScopes: !!oauthScopes
      }
    });

    // セッション情報の検証
    if (!user || !oauthTicket || !oauthClient || !oauthScopes) {
      oauthLogger.warn('Missing required data', { 
        user: !!user, 
        oauthTicket: !!oauthTicket, 
        oauthClient: !!oauthClient, 
        oauthScopes: !!oauthScopes 
      });
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters or session data'
      });
    }

    // セッションからticketを取得
    const ticket = oauthTicket;

    if (authorized === 'true') {
      const issueResponse = await (getAuthleteClient() as any).makeRequest('/auth/authorization/issue', {
        ticket,
        subject: user.username
      });

      if (issueResponse.action === 'LOCATION') {
        res.redirect(issueResponse.responseContent);
      } else if (issueResponse.action === 'FORM') {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.send(issueResponse.responseContent);
      } else {
        res.status(500).json({
          error: 'server_error',
          error_description: 'Failed to issue authorization response'
        });
      }
    } else {
      // 同意拒否時の処理
      oauthLogger.debug('Processing consent denial', {
        ticket: ticket,
        user: user.username
      });

      const failResponse = await (getAuthleteClient() as any).makeRequest('/auth/authorization/fail', {
        ticket,
        reason: 'DENIED',
        description: 'User denied the authorization request'
      });

      oauthLogger.debug('Authlete fail response', {
        action: failResponse.action,
        resultCode: failResponse.resultCode,
        resultMessage: failResponse.resultMessage,
        hasResponseContent: !!failResponse.responseContent
      });

      // Cache-Control と Pragma ヘッダーを設定
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');

      switch (failResponse.action) {
        case 'INTERNAL_SERVER_ERROR':
          oauthLogger.error('Authlete internal server error during authorization failure', {
            resultCode: failResponse.resultCode,
            resultMessage: failResponse.resultMessage
          });
          res.status(500).setHeader('Content-Type', 'application/json').send(failResponse.responseContent);
          break;

        case 'BAD_REQUEST':
          oauthLogger.warn('Bad request during authorization failure', {
            resultCode: failResponse.resultCode,
            resultMessage: failResponse.resultMessage
          });
          res.status(400).setHeader('Content-Type', 'application/json').send(failResponse.responseContent);
          break;

        case 'LOCATION':
          oauthLogger.debug('Redirecting client after consent denial', {
            redirectUri: failResponse.responseContent
          });
          res.redirect(failResponse.responseContent);
          break;

        case 'FORM':
          oauthLogger.debug('Returning form response after consent denial');
          res.setHeader('Content-Type', 'text/html; charset=UTF-8');
          res.send(failResponse.responseContent);
          break;

        default:
          oauthLogger.error('Unexpected action from Authlete fail API', {
            action: failResponse.action,
            resultCode: failResponse.resultCode,
            resultMessage: failResponse.resultMessage
          });
          res.status(500).json({
            error: 'server_error',
            error_description: 'Failed to generate authorization error response'
          });
      }
    }

    // セッション情報をクリーンアップ
    delete req.session.oauthTicket;
    delete req.session.oauthClient;
    delete req.session.oauthScopes;
    
    // セッション保存（クリーンアップ後）
    req.session.save((saveErr) => {
      if (saveErr) {
        oauthLogger.error('Session cleanup save error', saveErr);
      }
    });

  } catch (error) {
    oauthLogger.error('Authorization decision error', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error occurred'
    });
  }
});

export { router as oauthRoutes };