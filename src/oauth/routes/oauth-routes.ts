import express from 'express';
import { Authlete } from '@authlete/typescript-sdk';
import {
  AuthorizationDetailsElement,
  AuthorizationFailRequest,
  AuthorizationFailRequestReason,
  AuthorizationIssueRequest
} from '@authlete/typescript-sdk/models';
import { AuthorizationController } from '../controllers/authorization.js';
import { TokenController } from '../controllers/token.js';
import { IntrospectionController } from '../controllers/introspection.js';
import { DCRController } from '../controllers/dcr.js';
import { oauthLogger } from '../../utils/logger.js';
import { getAuthleteContext } from '../authlete-sdk.js';
import { csrfProtection, getCsrfToken } from '../../middleware/csrf.js';

const router = express.Router();

// 遅延初期化用の変数
let authlete: Authlete | null = null;
let serviceId: string | null = null;
let authorizationController: AuthorizationController | null = null;
let tokenController: TokenController | null = null;
let introspectionController: IntrospectionController | null = null;
let dcrController: DCRController | null = null;

// Authleteクライアントの遅延初期化
function ensureAuthlete(): void {
  if (!authlete) {
    const context = getAuthleteContext();
    authlete = context.authlete;
    serviceId = context.serviceId;
    authorizationController = new AuthorizationController(authlete, serviceId);
    tokenController = new TokenController(authlete, serviceId);
    introspectionController = new IntrospectionController(authlete, serviceId);
    dcrController = new DCRController(authlete, serviceId);
  }
}

function getAuthorizationController(): AuthorizationController {
  ensureAuthlete(); // 初期化を確実に行う
  return authorizationController!;
}

function getTokenController(): TokenController {
  ensureAuthlete(); // 初期化を確実に行う
  return tokenController!;
}

function getIntrospectionController(): IntrospectionController {
  ensureAuthlete(); // 初期化を確実に行う
  return introspectionController!;
}

function getDCRController(): DCRController {
  ensureAuthlete(); // 初期化を確実に行う
  return dcrController!;
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

// Dynamic Client Registration (DCR) endpoints - RFC 7591/7592
router.post('/register', (req, res) => {
  getDCRController().handleClientRegistration(req, res);
});

router.get('/register/:client_id', (req, res) => {
  getDCRController().handleClientGet(req, res);
});

router.put('/register/:client_id', (req, res) => {
  getDCRController().handleClientUpdate(req, res);
});

router.delete('/register/:client_id', (req, res) => {
  getDCRController().handleClientDelete(req, res);
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

  // Authorization Details サポート確認のデバッグログ
  oauthLogger.debug('Authorization Details support check', {
    clientId: oauthClient?.clientId,
    clientName: oauthClient?.clientName,
    authorizationDetailsTypes: oauthClient?.authorizationDetailsTypes,
    hasTicketReservation: oauthClient?.authorizationDetailsTypes?.includes('ticket-reservation'),
    fullClient: oauthClient
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
        .authorization-details { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        .auth-detail-option { margin: 15px 0; }
        .auth-detail-option label { margin-left: 8px; cursor: pointer; }
        .custom-options { padding: 15px; background: white; border-radius: 3px; border: 1px solid #dee2e6; }
        .limit-option { margin: 15px 0; }
        .limit-option label { display: block; margin-bottom: 5px; font-weight: bold; }
        .limit-option input[type="number"] { width: 100px; padding: 5px; margin: 0 5px; }
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

      <!-- Authorization Details Support Debug: 
           authorizationDetailsTypes: ${JSON.stringify(oauthClient.authorizationDetailsTypes)}
           hasTicketReservation: ${oauthClient.authorizationDetailsTypes && oauthClient.authorizationDetailsTypes.includes('ticket-reservation')}
      -->
      ${oauthClient.authorizationDetailsTypes && oauthClient.authorizationDetailsTypes.includes('ticket-reservation') ? `
      <div class="authorization-details">
        <h3>詳細なアクセス権限設定</h3>
        <div class="auth-detail-option">
          <input type="radio" id="scope-only" name="auth-detail-mode" value="scope-only" checked>
          <label for="scope-only">標準権限 (上記スコープの範囲ですべて許可)</label>
        </div>
        
        <div class="auth-detail-option">
          <input type="radio" id="custom-limits" name="auth-detail-mode" value="custom">
          <label for="custom-limits">金額制限付き</label>
          
          <div class="custom-options" id="custom-options" style="display: none; margin-left: 20px; margin-top: 10px;">
            <div class="limit-option">
              <label for="max-amount">予約可能な最大金額:</label>
              <input type="number" id="max-amount" name="max-amount" min="0" value="10000" step="100">
              <span>円</span>
            </div>
          </div>
        </div>
      </div>
      ` : ''}

      <div class="buttons">
        <form id="consent-form" action="/oauth/authorize/decision" method="post" style="display: inline;">
          <input type="hidden" name="_csrf" value="${getCsrfToken(req)}">
          <input type="hidden" name="authorized" value="true">
          <input type="hidden" name="authorizationDetailsJson" id="authorizationDetailsJson">
          <button type="submit" class="approve">許可する</button>
        </form>
        
        <form action="/oauth/authorize/decision" method="post" style="display: inline;">
          <input type="hidden" name="_csrf" value="${getCsrfToken(req)}">
          <input type="hidden" name="authorized" value="false">
          <button type="submit" class="deny">拒否する</button>
        </form>
      </div>

      <script>
        document.addEventListener('DOMContentLoaded', function() {
          const scopeOnlyRadio = document.getElementById('scope-only');
          const customLimitsRadio = document.getElementById('custom-limits');
          const customOptions = document.getElementById('custom-options');
          const consentForm = document.getElementById('consent-form');

          // authorization detailsが有効な場合のみ処理を実行
          if (scopeOnlyRadio && customLimitsRadio && customOptions) {
            // ラジオボタンの切り替え処理
            function toggleCustomOptions() {
              if (customLimitsRadio.checked) {
                customOptions.style.display = 'block';
              } else {
                customOptions.style.display = 'none';
              }
            }

            scopeOnlyRadio.addEventListener('change', toggleCustomOptions);
            customLimitsRadio.addEventListener('change', toggleCustomOptions);

            // フォーム送信時の処理
            consentForm.addEventListener('submit', function(e) {
              if (customLimitsRadio.checked) {
                const maxAmount = document.getElementById('max-amount').value;

                const authorizationDetails = [{
                  type: "ticket-reservation",
                  actions: ["book", "cancel"],
                  otherFields: JSON.stringify({
                    maxAmount: parseInt(maxAmount),
                    currency: "JPY"
                  })
                }];

                document.getElementById('authorizationDetailsJson').value = JSON.stringify(authorizationDetails);
              } else {
                document.getElementById('authorizationDetailsJson').value = '';
              }
            });
          }
        });
      </script>
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

router.post('/authorize/decision', csrfProtection, async (req, res) => {
  oauthLogger.debug('Decision endpoint called', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
    sessionId: req.session.id,
    userAuthenticated: !!req.user
  });

  try {
    const { authorized, authorizationDetailsJson } = req.body;
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

    ensureAuthlete();

    if (!authlete || !serviceId) {
      oauthLogger.error('Authlete SDK not initialized');
      return res.status(500).json({
        error: 'server_error',
        error_description: 'Authlete SDK not initialized'
      });
    }

    if (authorized === 'true') {
      const issueParams: AuthorizationIssueRequest = {
        ticket,
        subject: user.id.toString() // ユーザーIDを文字列として設定
      };

      // authorizationDetailsの処理
      if (authorizationDetailsJson && authorizationDetailsJson.trim() !== '') {
        try {
          const authorizationDetailsArray: AuthorizationDetailsElement[] = JSON.parse(authorizationDetailsJson);
          issueParams.authorizationDetails = {
            elements: authorizationDetailsArray // elements配列として設定
          };

          oauthLogger.debug('Authorization details parsed', {
            authorizationDetails: issueParams.authorizationDetails
          });
        } catch (error) {
          oauthLogger.error('Failed to parse authorization details JSON', {
            authorizationDetailsJson,
            error
          });
        }
      }

      // デバッグログ: issue エンドポイントに送信するパラメーター
      oauthLogger.debug('Authlete authorization/issue request params', {
        ticket: ticket.substring(0, 20) + '...',
        subject: issueParams.subject,
        username: user.username,
        hasAuthorizationDetails: !!issueParams.authorizationDetails
      });

      const issueResponse = await authlete.authorization.issue({
        serviceId,
        authorizationIssueRequest: issueParams
      });

      // デバッグログ: issue エンドポイントのレスポンス
      oauthLogger.debug('Authlete authorization/issue response', {
        action: issueResponse.action,
        resultCode: issueResponse.resultCode,
        resultMessage: issueResponse.resultMessage
      });

      if (issueResponse.action === 'LOCATION' && issueResponse.responseContent) {
        res.redirect(issueResponse.responseContent);
      } else if (issueResponse.action === 'FORM' && issueResponse.responseContent) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.send(issueResponse.responseContent);
      } else if (issueResponse.responseContent) {
        res.setHeader('Content-Type', 'application/json');
        res.status(500).send(issueResponse.responseContent);
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

      const failRequest: AuthorizationFailRequest = {
        ticket,
        reason: AuthorizationFailRequestReason.Denied,
        description: 'User denied the authorization request'
      };

      const failResponse = await authlete.authorization.fail({
        serviceId,
        authorizationFailRequest: failRequest
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
          if (failResponse.responseContent) {
            oauthLogger.debug('Redirecting client after consent denial', {
              redirectUri: failResponse.responseContent
            });
            res.redirect(failResponse.responseContent);
          } else {
            res.status(500).json({
              error: 'server_error',
              error_description: 'No redirect content provided'
            });
          }
          break;

        case 'FORM':
          if (failResponse.responseContent) {
            oauthLogger.debug('Returning form response after consent denial');
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            res.send(failResponse.responseContent);
          } else {
            res.status(500).json({
              error: 'server_error',
              error_description: 'No form content provided'
            });
          }
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
