import express from 'express';
import { AuthorizationController } from '../controllers/authorization.js';
import { TokenController } from '../controllers/token.js';
import { getAuthorizationServerMetadata } from '../controllers/authorization-server-metadata.js';
import { getProtectedResourceMetadata } from '../controllers/protected-resource-metadata.js';
import { createAuthleteClient, AuthleteClient } from '../authlete/client.js';
import { getAuthleteConfig } from '../config/authlete-config.js';

const router = express.Router();

// 遅延初期化用の変数
let authleteClient: AuthleteClient | null = null;
let authorizationController: AuthorizationController | null = null;
let tokenController: TokenController | null = null;

// Authleteクライアントの遅延初期化
function getAuthleteClient(): AuthleteClient {
  if (!authleteClient) {
    const authleteConfig = getAuthleteConfig();
    authleteClient = createAuthleteClient(authleteConfig);
    authorizationController = new AuthorizationController(authleteClient);
    tokenController = new TokenController(authleteClient);
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

router.get('/authorize', (req, res) => {
  getAuthorizationController().handleAuthorizationRequest(req, res);
});

router.post('/authorize', (req, res) => {
  getAuthorizationController().handleAuthorizationRequest(req, res);
});

router.post('/token', (req, res) => {
  getTokenController().handleTokenRequest(req, res);
});

router.get('/authorize/consent', (req, res) => {
  const { ticket } = req.query;
  const { oauthTicket, oauthClient, oauthScopes } = req.session;

  // セッション情報の検証
  if (!oauthTicket || !oauthClient || !oauthScopes) {
    console.log('Missing session data:', { oauthTicket, oauthClient: !!oauthClient, oauthScopes: !!oauthScopes });
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing authorization session data'
    });
  }

  // ticketパラメータとセッションのticketが一致するか確認
  if (ticket !== oauthTicket) {
    console.log('Ticket mismatch:', { queryTicket: ticket, sessionTicket: oauthTicket });
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Invalid authorization ticket'
    });
  }

  // ユーザー認証確認
  if (!req.user) {
    return res.redirect(`/auth/login?ticket=${ticket}&return_to=${encodeURIComponent(req.originalUrl)}`);
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
          <input type="hidden" name="ticket" value="${oauthTicket}">
          <input type="hidden" name="authorized" value="true">
          <button type="submit" class="approve">許可する</button>
        </form>
        
        <form action="/oauth/authorize/decision" method="post" style="display: inline;">
          <input type="hidden" name="ticket" value="${oauthTicket}">
          <input type="hidden" name="authorized" value="false">
          <button type="submit" class="deny">拒否する</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

router.post('/authorize/decision', async (req, res) => {
  try {
    const { ticket, authorized } = req.body;
    const user = req.user as any;
    const { oauthTicket, oauthClient, oauthScopes } = req.session;

    // セッション情報とticketの検証
    if (!ticket || !user || !oauthTicket || !oauthClient || !oauthScopes) {
      console.log('Missing required data:', { 
        ticket: !!ticket, 
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

    // ticketの一致確認
    if (ticket !== oauthTicket) {
      console.log('Ticket mismatch in decision:', { bodyTicket: ticket, sessionTicket: oauthTicket });
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid authorization ticket'
      });
    }

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
      const failResponse = await (getAuthleteClient() as any).makeRequest('/auth/authorization/fail', {
        ticket,
        reason: 'DENIED'
      });

      if (failResponse.action === 'LOCATION') {
        res.redirect(failResponse.responseContent);
      } else if (failResponse.action === 'FORM') {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.send(failResponse.responseContent);
      } else {
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
        console.error('Session cleanup save error:', saveErr);
      }
    });

  } catch (error) {
    console.error('Authorization decision error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error occurred'
    });
  }
});

export { router as oauthRoutes };