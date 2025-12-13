import { csrfSync } from 'csrf-sync';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// セッションベースのCSRF保護設定
const { csrfSynchronisedProtection, generateToken } = csrfSync({
    getTokenFromRequest: (req) => {
        // フォームのhidden fieldまたはヘッダーからトークンを取得
        return req.body._csrf || req.headers['x-csrf-token'];
    },
    getTokenFromState: (req) => {
        // セッションからトークンを取得
        return req.session.csrfToken;
    },
    storeTokenInState: (req, token) => {
        // セッションにトークンを保存
        req.session.csrfToken = token;
    },
    size: 64, // トークンのサイズ（バイト）
});

// CSRFトークン生成ミドルウェア
export const csrfTokenMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // セッションにトークンがなければ生成
    if (!req.session.csrfToken) {
        const token = generateToken(req);
        req.session.csrfToken = token;
    }

    // テンプレートで使用できるようにres.localsに設定
    res.locals.csrfToken = req.session.csrfToken;

    next();
};

// CSRF検証ミドルウェア
export const csrfProtection = csrfSynchronisedProtection;

// CSRFトークン取得ヘルパー
export const getCsrfToken = (req: Request): string => {
    return req.session.csrfToken || '';
};
