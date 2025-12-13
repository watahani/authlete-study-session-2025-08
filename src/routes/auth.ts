import express from 'express';
import passport from 'passport';
import { AuthService } from '../services/AuthService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ログインページ表示
router.get('/login', (req, res) => {
  const { return_to } = req.query;
  const hasOAuthSession = !!req.session.oauthTicket;

  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ログイン - チケット販売サービス</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; }
        .container { background: #f9f9f9; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
        button { width: 100%; background: #007bff; color: white; padding: 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
        button:hover { background: #0056b3; }
        .info { background: #e7f3ff; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #007bff; }
        .error { background: #ffe7e7; padding: 15px; border-radius: 4px; margin-bottom: 20px; border-left: 4px solid #dc3545; color: #721c24; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>ログイン</h2>
        ${hasOAuthSession ? '<div class="info">OAuth認可のためにログインが必要です。</div>' : ''}
        
        <form action="/auth/login" method="post">
          ${return_to ? `<input type="hidden" name="return_to" value="${return_to}">` : ''}
          
          <div class="form-group">
            <label for="username">ユーザー名:</label>
            <input type="text" id="username" name="username" required>
          </div>
          
          <div class="form-group">
            <label for="password">パスワード:</label>
            <input type="password" id="password" name="password" required>
          </div>
          
          <button type="submit">ログイン</button>
        </form>
        
        <div style="margin-top: 20px; text-align: center;">
          <p>テスト用アカウント:</p>
          <p><strong>ユーザー名:</strong> testuser</p>
          <p><strong>パスワード:</strong> testpass</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await AuthService.register({ username, password, email });
    res.status(201).json({ message: 'User created successfully', user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Registration failed';
    res.status(400).json({ error: errorMessage });
  }
});

router.post('/login', (req, res, next) => {
  const { return_to } = req.body;

  // ログイン前のOAuthデータを保存
  const preservedOAuthData = {
    oauthTicket: req.session.oauthTicket,
    oauthClient: req.session.oauthClient,
    oauthScopes: req.session.oauthScopes
  };

  logger.debug('Preserving OAuth data before login', {
    sessionId: req.session.id,
    hasTicket: !!preservedOAuthData.oauthTicket,
    hasClient: !!preservedOAuthData.oauthClient,
    hasScopes: !!preservedOAuthData.oauthScopes
  });

  passport.authenticate('local', (err: Error, user: Express.User | false) => {
    if (err) {
      return res.status(500).json({ error: 'Authentication error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ error: 'Login failed' });
      }

      // OAuthデータを復元
      if (preservedOAuthData.oauthTicket) {
        req.session.oauthTicket = preservedOAuthData.oauthTicket;
        req.session.oauthClient = preservedOAuthData.oauthClient;
        req.session.oauthScopes = preservedOAuthData.oauthScopes;
        logger.debug('OAuth data restored after login', {
          sessionId: req.session.id,
          oauthTicket: req.session.oauthTicket,
          hasClient: !!req.session.oauthClient,
          hasScopes: !!req.session.oauthScopes
        });
      }

      // ログイン前のセッションデバッグ
      logger.debug('Login success - Session debug', {
        sessionId: req.session.id,
        hasOAuthData: {
          oauthTicket: !!req.session.oauthTicket,
          oauthClient: !!req.session.oauthClient,
          oauthScopes: !!req.session.oauthScopes
        },
        allSessionKeys: Object.keys(req.session)
      });

      // セッション保存を確実に行う
      req.session.save((saveErr) => {
        if (saveErr) {
          logger.error('Session save error after login', saveErr);
          return res.status(500).json({ error: 'Session management failed' });
        }

        logger.debug('Session saved after login - OAuth data preserved', {
          oauthTicket: !!req.session.oauthTicket,
          oauthClient: !!req.session.oauthClient,
          oauthScopes: !!req.session.oauthScopes
        });

        // OAuth認可フローからのリダイレクト処理（セッションのoauthTicketを確認）
        if (req.session.oauthTicket) {
          logger.debug('Redirecting to consent (OAuth session detected)');
          return res.redirect('/oauth/authorize/consent');
        }

        // 通常のリダイレクト処理
        if (return_to) {
          return res.redirect(return_to);
        }

        // JSON APIレスポンス（フロントエンド用）
        return res.json({
          message: 'Login successful',
          user: {
            username: (user as any).username,
            id: (user as any).id
          }
        });
      });
    });
  })(req, res, next);
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

router.get('/profile', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
});

export { router as authRoutes };