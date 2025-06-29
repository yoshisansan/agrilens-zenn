const express = require('express');
const router = express.Router();

// ミドルウェア
const { generalRateLimit } = require('../middleware/rateLimit');
const { securityValidation } = require('../middleware/validation');
const { requestLogger, performanceLogger } = require('../middleware/logging');

// サブルートのインポート
const aiRoutes = require('./ai');
const analysisRoutes = require('./analysis');
const authRoutes = require('./auth');
const healthRoutes = require('./health');

// 共通ミドルウェアの適用
router.use(requestLogger);
router.use(performanceLogger);
router.use(generalRateLimit);
router.use(securityValidation);

// ルートのマウント
router.use('/ai', aiRoutes);
router.use('/analysis', analysisRoutes);
router.use('/auth', authRoutes);
router.use('/health', healthRoutes);

// APIルートのリスト（開発用）
router.get('/', (req, res) => {
    res.json({
        message: 'AgriLens API v1.0',
        documentation: '/api/docs',
        endpoints: {
            ai: '/api/ai',
            analysis: '/api/analysis',
            auth: '/api/auth',
            health: '/api/health',
            'server-info': '/api/server-info',
            'auth-status': '/api/auth-status'
        },
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// サーバー情報エンドポイント
router.get('/server-info', (req, res) => {
    const config = require('../config');
    res.json({
        server: {
            name: 'AgriLens',
            version: '1.0.0',
            environment: config.env,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            nodeVersion: process.version
        },
        features: {
            ai: true,
            gee: true,
            authentication: true,
            rateLimit: true
        },
        timestamp: new Date().toISOString()
    });
});

// 認証状態エンドポイント
router.get('/auth-status', (req, res) => {
    res.json({
        authenticated: false,
        user: null,
        sessionId: req.session?.id || null,
        permissions: ['read'],
        timestamp: new Date().toISOString()
    });
});

module.exports = router;