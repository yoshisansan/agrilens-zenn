const express = require('express');
const router = express.Router();

// ミドルウェア
const { authRateLimit } = require('../middleware/rateLimit');
const { initializeSession, destroySession, refreshSession } = require('../middleware/auth');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errors');

// 認証エンドポイント
router.get('/',
    authRateLimit,
    asyncHandler(async (req, res) => {
        // 簡易認証（モックデータモード用）
        const user = {
            username: 'authenticated-user',
            role: 'user',
            loginTime: new Date().toISOString()
        };

        // セッション初期化
        initializeSession(req, user);

        logger.audit('User authenticated', {
            username: user.username,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.redirect('/');
    })
);

// 認証コールバック（後方互換性用）
router.get('/callback',
    authRateLimit,
    asyncHandler(async (req, res) => {
        const { code } = req.query;
        
        logger.info('Auth callback received', {
            hasCode: !!code,
            ip: req.ip
        });

        // 簡易認証
        const user = {
            username: 'authenticated-user',
            role: 'user',
            loginTime: new Date().toISOString()
        };

        initializeSession(req, user);

        logger.audit('User authenticated via callback', {
            username: user.username,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.redirect('/');
    })
);

// ログアウト
router.post('/logout',
    authRateLimit,
    asyncHandler(async (req, res) => {
        const username = req.session?.user?.username || 'unknown';

        try {
            await destroySession(req);
            
            logger.audit('User logged out', {
                username: username,
                ip: req.ip
            });

            res.json({
                success: true,
                message: 'ログアウトしました',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Logout failed', error, {
                username: username,
                ip: req.ip
            });

            res.status(500).json({
                error: true,
                message: 'ログアウトに失敗しました',
                timestamp: new Date().toISOString()
            });
        }
    })
);

// セッション更新
router.post('/refresh',
    refreshSession,
    asyncHandler(async (req, res) => {
        if (req.session && req.session.authenticated) {
            res.json({
                success: true,
                user: req.session.user,
                expiresAt: req.session.expiresAt,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(401).json({
                error: true,
                code: 'SESSION_INVALID',
                message: 'セッションが無効です',
                timestamp: new Date().toISOString()
            });
        }
    })
);

// 認証状態確認
router.get('/status',
    asyncHandler(async (req, res) => {
        const isAuthenticated = req.session && req.session.authenticated;
        
        res.json({
            authenticated: isAuthenticated,
            user: isAuthenticated ? req.session.user : null,
            sessionId: req.sessionID,
            timestamp: new Date().toISOString()
        });
    })
);

module.exports = router;