const rateLimit = require('express-rate-limit');
const securityConfig = require('../config/security');
const logger = require('../utils/logger');

// IP取得ヘルパー関数
function getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           'unknown';
}

// レート制限ヒット時のログ記録
function logRateLimitHit(req, limit, endpoint) {
    const clientIP = getClientIP(req);
    logger.warn('Rate limit exceeded', {
        ip: clientIP,
        endpoint: endpoint,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString(),
        limit: limit.max,
        window: limit.windowMs,
        remainingHits: req.rateLimit?.remaining || 0,
        totalHits: req.rateLimit?.total || 0
    });
}

// カスタムレスポンス生成
function createRateLimitResponse(message, retryAfter, code) {
    return {
        error: true,
        code: code,
        message: message.error,
        retryAfter: message.retryAfter,
        timestamp: new Date().toISOString(),
        docs: 'https://github.com/agrilens/api-docs#rate-limits'
    };
}

// AI API用レート制限
const createAIRateLimit = () => {
    const config = securityConfig.rateLimit.aiApi;
    
    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        standardHeaders: config.standardHeaders,
        legacyHeaders: config.legacyHeaders,
        message: createRateLimitResponse(config.message, config.windowMs / 1000, config.message.code),
        skipSuccessfulRequests: config.skipSuccessfulRequests,
        skipFailedRequests: config.skipFailedRequests,
        skip: (req) => {
            // 開発環境でのスキップ条件
            if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
                return true;
            }
            return false;
        },
        handler: (req, res, next, options) => {
            logRateLimitHit(req, config, 'AI API');
            
            // セキュリティイベントとして記録
            logger.security('AI API rate limit exceeded', {
                ip: getClientIP(req),
                endpoint: req.originalUrl,
                method: req.method,
                userAgent: req.headers['user-agent']
            });
            
            res.status(options.statusCode).json(options.message);
        },
        keyGenerator: (req) => {
            // IPベースのキー生成（将来的にはユーザーベースも考慮）
            return `ai_api:${getClientIP(req)}`;
        }
    });
};

// 分析API用レート制限
const createAnalysisRateLimit = () => {
    const config = securityConfig.rateLimit.analysisApi;
    
    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        standardHeaders: config.standardHeaders,
        legacyHeaders: config.legacyHeaders,
        message: createRateLimitResponse(config.message, config.windowMs / 1000, config.message.code),
        skipSuccessfulRequests: config.skipSuccessfulRequests,
        skipFailedRequests: config.skipFailedRequests,
        skip: (req) => {
            if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
                return true;
            }
            return false;
        },
        handler: (req, res, next, options) => {
            logRateLimitHit(req, config, 'Analysis API');
            
            logger.security('Analysis API rate limit exceeded', {
                ip: getClientIP(req),
                endpoint: req.originalUrl,
                method: req.method,
                userAgent: req.headers['user-agent'],
                bodySize: req.headers['content-length'] || 'unknown'
            });
            
            res.status(options.statusCode).json(options.message);
        },
        keyGenerator: (req) => {
            return `analysis_api:${getClientIP(req)}`;
        }
    });
};

// 認証API用レート制限
const createAuthRateLimit = () => {
    const config = securityConfig.rateLimit.authApi;
    
    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        standardHeaders: config.standardHeaders,
        legacyHeaders: config.legacyHeaders,
        message: createRateLimitResponse(config.message, config.windowMs / 1000, config.message.code),
        skipSuccessfulRequests: config.skipSuccessfulRequests,
        skipFailedRequests: config.skipFailedRequests,
        skip: (req) => {
            if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
                return true;
            }
            return false;
        },
        handler: (req, res, next, options) => {
            logRateLimitHit(req, config, 'Auth API');
            
            // 認証試行の制限は特にセキュリティ上重要
            logger.security('Auth API rate limit exceeded - potential brute force attack', {
                ip: getClientIP(req),
                endpoint: req.originalUrl,
                method: req.method,
                userAgent: req.headers['user-agent'],
                severity: 'HIGH'
            });
            
            res.status(options.statusCode).json(options.message);
        },
        keyGenerator: (req) => {
            return `auth_api:${getClientIP(req)}`;
        }
    });
};

// 一般API用レート制限
const createGeneralRateLimit = () => {
    const config = securityConfig.rateLimit.general;
    
    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        standardHeaders: config.standardHeaders,
        legacyHeaders: config.legacyHeaders,
        message: createRateLimitResponse(config.message, config.windowMs / 1000, config.message.code),
        skipSuccessfulRequests: config.skipSuccessfulRequests,
        skipFailedRequests: config.skipFailedRequests,
        skip: (req) => {
            // 静的ファイルはスキップ
            if (req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
                return true;
            }
            
            // ヘルスチェックはスキップ
            if (req.url === '/health' || req.url === '/ping') {
                return true;
            }
            
            if (process.env.NODE_ENV === 'development' && process.env.SKIP_RATE_LIMIT === 'true') {
                return true;
            }
            
            return false;
        },
        handler: (req, res, next, options) => {
            logRateLimitHit(req, config, 'General API');
            
            logger.warn('General rate limit exceeded', {
                ip: getClientIP(req),
                endpoint: req.originalUrl,
                method: req.method,
                userAgent: req.headers['user-agent']
            });
            
            res.status(options.statusCode).json(options.message);
        },
        keyGenerator: (req) => {
            return `general_api:${getClientIP(req)}`;
        }
    });
};

// レート制限の統計情報取得（将来の監視用）
function getRateLimitStats(req) {
    const stats = {
        ip: getClientIP(req),
        remaining: req.rateLimit?.remaining || 0,
        total: req.rateLimit?.total || 0,
        resetTime: req.rateLimit?.resetTime || null,
        used: (req.rateLimit?.total || 0) - (req.rateLimit?.remaining || 0)
    };
    
    return stats;
}

// ミドルウェアエクスポート
module.exports = {
    aiRateLimit: createAIRateLimit(),
    analysisRateLimit: createAnalysisRateLimit(),
    authRateLimit: createAuthRateLimit(),
    generalRateLimit: createGeneralRateLimit(),
    getRateLimitStats
};