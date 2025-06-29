const config = require('../config');
const securityConfig = require('../config/security');
const logger = require('../utils/logger');
const crypto = require('crypto');

// カスタム認証エラークラス
class AuthenticationError extends Error {
    constructor(message, code = 'AUTH_FAILED') {
        super(message);
        this.name = 'AuthenticationError';
        this.code = code;
        this.statusCode = 401;
    }
}

class AuthorizationError extends Error {
    constructor(message, code = 'AUTH_INSUFFICIENT') {
        super(message);
        this.name = 'AuthorizationError';
        this.code = code;
        this.statusCode = 403;
    }
}

// セッション検証
function validateSession(req) {
    if (!req.session) {
        return false;
    }
    
    // セッションの有効期限チェック
    if (req.session.expiresAt && req.session.expiresAt < Date.now()) {
        return false;
    }
    
    // セッションのIPアドレス検証（オプション）
    if (config.isProduction() && req.session.ipAddress) {
        const currentIP = req.ip || req.connection.remoteAddress;
        if (req.session.ipAddress !== currentIP) {
            logger.security('Session IP mismatch detected', {
                sessionIP: req.session.ipAddress,
                currentIP: currentIP,
                sessionId: req.sessionID
            });
            return false;
        }
    }
    
    return req.session.authenticated === true;
}

// Basic認証実装
function createBasicAuth(username, password) {
    return (req, res, next) => {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Basic ')) {
            res.set('WWW-Authenticate', 'Basic realm="AgriLens API"');
            return res.status(401).json({
                error: true,
                code: 'AUTH_REQUIRED',
                message: 'Basic認証が必要です'
            });
        }
        
        try {
            const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
            const [providedUsername, providedPassword] = credentials.split(':');
            
            // 定数時間比較でタイミング攻撃を防ぐ
            const usernameMatch = crypto.timingSafeEqual(
                Buffer.from(username, 'utf-8'),
                Buffer.from(providedUsername || '', 'utf-8')
            );
            
            const passwordMatch = crypto.timingSafeEqual(
                Buffer.from(password, 'utf-8'),
                Buffer.from(providedPassword || '', 'utf-8')
            );
            
            if (!usernameMatch || !passwordMatch) {
                logger.security('Basic auth failed', {
                    ip: req.ip,
                    userAgent: req.headers['user-agent'],
                    endpoint: req.originalUrl,
                    providedUsername: providedUsername
                });
                
                res.set('WWW-Authenticate', 'Basic realm="AgriLens API"');
                return res.status(401).json({
                    error: true,
                    code: 'AUTH_INVALID',
                    message: '認証情報が無効です'
                });
            }
            
            // 認証成功
            req.authenticated = true;
            req.user = { username: providedUsername };
            
            logger.audit('Basic auth successful', {
                username: providedUsername,
                ip: req.ip,
                endpoint: req.originalUrl
            });
            
            next();
        } catch (error) {
            logger.error('Basic auth processing error', error, {
                ip: req.ip,
                endpoint: req.originalUrl
            });
            
            res.set('WWW-Authenticate', 'Basic realm="AgriLens API"');
            return res.status(401).json({
                error: true,
                code: 'AUTH_ERROR',
                message: '認証処理中にエラーが発生しました'
            });
        }
    };
}

// セッションベース認証ミドルウェア
function requireAuthentication(req, res, next) {
    // 開発環境での認証スキップ（設定による）
    if (config.isDevelopment() && process.env.SKIP_AUTH === 'true') {
        req.authenticated = true;
        req.user = { username: 'dev-user', role: 'admin' };
        return next();
    }
    
    if (!validateSession(req)) {
        logger.security('Authentication required', {
            ip: req.ip,
            endpoint: req.originalUrl,
            sessionId: req.sessionID,
            userAgent: req.headers['user-agent']
        });
        
        return res.status(401).json({
            error: true,
            code: 'AUTH_REQUIRED',
            message: '認証が必要です',
            loginUrl: '/auth'
        });
    }
    
    // 認証成功時の情報設定
    req.authenticated = true;
    req.user = req.session.user || { username: 'authenticated-user' };
    
    next();
}

// オプショナル認証（認証されていなくても通すが、認証状態を確認）
function optionalAuthentication(req, res, next) {
    if (validateSession(req)) {
        req.authenticated = true;
        req.user = req.session.user || { username: 'authenticated-user' };
    } else {
        req.authenticated = false;
        req.user = null;
    }
    
    next();
}

// 権限チェックミドルウェア
function requireRole(requiredRole) {
    return (req, res, next) => {
        if (!req.authenticated) {
            return res.status(401).json({
                error: true,
                code: 'AUTH_REQUIRED',
                message: '認証が必要です'
            });
        }
        
        const userRole = req.user?.role || 'user';
        
        // 簡単な権限システム（将来拡張可能）
        const roleHierarchy = {
            'admin': ['admin', 'moderator', 'user'],
            'moderator': ['moderator', 'user'],
            'user': ['user']
        };
        
        const allowedRoles = roleHierarchy[userRole] || [userRole];
        
        if (!allowedRoles.includes(requiredRole)) {
            logger.security('Authorization failed', {
                username: req.user?.username,
                userRole: userRole,
                requiredRole: requiredRole,
                ip: req.ip,
                endpoint: req.originalUrl
            });
            
            return res.status(403).json({
                error: true,
                code: 'AUTH_INSUFFICIENT',
                message: '権限が不足しています',
                requiredRole: requiredRole,
                currentRole: userRole
            });
        }
        
        next();
    };
}

// API キー認証（将来の拡張用）
function createApiKeyAuth(validApiKeys) {
    return (req, res, next) => {
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;
        
        if (!apiKey) {
            return res.status(401).json({
                error: true,
                code: 'API_KEY_REQUIRED',
                message: 'APIキーが必要です'
            });
        }
        
        if (!validApiKeys.includes(apiKey)) {
            logger.security('Invalid API key attempt', {
                ip: req.ip,
                apiKey: apiKey.substring(0, 8) + '***',
                endpoint: req.originalUrl,
                userAgent: req.headers['user-agent']
            });
            
            return res.status(401).json({
                error: true,
                code: 'API_KEY_INVALID',
                message: '無効なAPIキーです'
            });
        }
        
        req.authenticated = true;
        req.user = { apiKey: apiKey, type: 'api' };
        
        logger.audit('API key authentication successful', {
            apiKey: apiKey.substring(0, 8) + '***',
            ip: req.ip,
            endpoint: req.originalUrl
        });
        
        next();
    };
}

// セッション初期化
function initializeSession(req, user, options = {}) {
    req.session.authenticated = true;
    req.session.user = user;
    req.session.loginTime = Date.now();
    req.session.expiresAt = Date.now() + (options.maxAge || 24 * 60 * 60 * 1000); // デフォルト24時間
    
    // セキュリティ情報の記録
    if (config.isProduction()) {
        req.session.ipAddress = req.ip || req.connection.remoteAddress;
        req.session.userAgent = req.headers['user-agent'];
    }
    
    logger.audit('Session initialized', {
        username: user.username,
        ip: req.ip,
        sessionId: req.sessionID,
        expiresAt: new Date(req.session.expiresAt).toISOString()
    });
}

// セッション破棄
function destroySession(req) {
    return new Promise((resolve, reject) => {
        const sessionId = req.sessionID;
        const username = req.session?.user?.username;
        
        req.session.destroy((err) => {
            if (err) {
                logger.error('Session destroy error', err, {
                    sessionId: sessionId,
                    username: username
                });
                reject(err);
            } else {
                logger.audit('Session destroyed', {
                    sessionId: sessionId,
                    username: username,
                    ip: req.ip
                });
                resolve();
            }
        });
    });
}

// セッション更新（活動延長）
function refreshSession(req, res, next) {
    if (req.session && req.session.authenticated) {
        const now = Date.now();
        const sessionAge = now - (req.session.loginTime || now);
        const maxAge = 24 * 60 * 60 * 1000; // 24時間
        
        // セッションが古すぎる場合は無効化
        if (sessionAge > maxAge) {
            destroySession(req);
            return res.status(401).json({
                error: true,
                code: 'SESSION_EXPIRED',
                message: 'セッションが期限切れです'
            });
        }
        
        // セッション延長
        req.session.expiresAt = now + maxAge;
        req.session.touch(); // セッションを更新
    }
    
    next();
}

module.exports = {
    // 認証ミドルウェア
    requireAuthentication,
    optionalAuthentication,
    requireRole,
    
    // 認証方式
    createBasicAuth,
    createApiKeyAuth,
    
    // セッション管理
    initializeSession,
    destroySession,
    refreshSession,
    validateSession,
    
    // エラークラス
    AuthenticationError,
    AuthorizationError
};