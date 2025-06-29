const logger = require('../utils/logger');
const { getRateLimitStats } = require('./rateLimit');

// リクエスト開始時刻を記録するためのミドルウェア
function requestTimer(req, res, next) {
    req.startTime = Date.now();
    next();
}

// レスポンス時間の計算
function calculateResponseTime(req) {
    return req.startTime ? Date.now() - req.startTime : 0;
}

// セキュリティイベントのタイプ分類
function classifySecurityEvent(req, res) {
    const statusCode = res.statusCode;
    const endpoint = req.originalUrl;
    
    // 認証関連
    if (statusCode === 401) {
        return 'authentication_failure';
    }
    
    if (statusCode === 403) {
        return 'authorization_failure';
    }
    
    // レート制限
    if (statusCode === 429) {
        return 'rate_limit_exceeded';
    }
    
    // バリデーション失敗
    if (statusCode === 400) {
        return 'validation_failure';
    }
    
    // サーバーエラー
    if (statusCode >= 500) {
        return 'server_error';
    }
    
    // 疑わしいアクティビティ
    if (endpoint.includes('..') || endpoint.includes('script') || endpoint.includes('eval')) {
        return 'suspicious_activity';
    }
    
    return null;
}

// リクエストログミドルウェア
function requestLogger(req, res, next) {
    const startTime = Date.now();
    req.startTime = startTime;
    
    // レスポンス完了時の処理
    const originalSend = res.send;
    res.send = function(data) {
        const responseTime = Date.now() - startTime;
        
        // 基本的なリクエスト情報
        const logData = {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTime: responseTime,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            referer: req.headers.referer,
            contentLength: res.get('content-length') || (data ? data.length : 0),
            authenticated: req.authenticated || false,
            username: req.user?.username || 'anonymous',
            sessionId: req.sessionID,
            timestamp: new Date().toISOString()
        };
        
        // レート制限統計情報の追加
        if (req.rateLimit) {
            logData.rateLimit = getRateLimitStats(req);
        }
        
        // セキュリティイベントの分類
        const securityEventType = classifySecurityEvent(req, res);
        if (securityEventType) {
            logData.securityEvent = securityEventType;
        }
        
        // ログレベルの決定
        if (res.statusCode >= 500) {
            logger.error('Request completed with server error', null, logData);
        } else if (res.statusCode >= 400) {
            logger.warn('Request completed with client error', logData);
        } else if (responseTime > 5000) {
            // 5秒以上の遅いリクエストは警告
            logger.warn('Slow request detected', logData);
        } else {
            logger.info('Request completed', logData);
        }
        
        // セキュリティイベントの場合は別途ログ
        if (securityEventType) {
            logger.security(`Security event: ${securityEventType}`, {
                ...logData,
                severity: getSeverityLevel(securityEventType, res.statusCode),
                description: getSecurityEventDescription(securityEventType)
            });
        }
        
        originalSend.call(this, data);
    };
    
    next();
}

// セキュリティイベントの重要度判定
function getSeverityLevel(eventType, statusCode) {
    switch (eventType) {
        case 'suspicious_activity':
            return 'HIGH';
        case 'authentication_failure':
            return 'MEDIUM';
        case 'authorization_failure':
            return 'MEDIUM';
        case 'rate_limit_exceeded':
            return 'LOW';
        case 'server_error':
            return statusCode >= 500 ? 'HIGH' : 'MEDIUM';
        default:
            return 'LOW';
    }
}

// セキュリティイベントの説明取得
function getSecurityEventDescription(eventType) {
    const descriptions = {
        'authentication_failure': '認証に失敗しました',
        'authorization_failure': '権限が不足しています',
        'rate_limit_exceeded': 'レート制限に達しました',
        'validation_failure': '入力データの検証に失敗しました',
        'server_error': 'サーバー内部エラーが発生しました',
        'suspicious_activity': '疑わしいアクティビティが検出されました'
    };
    
    return descriptions[eventType] || '不明なセキュリティイベント';
}

// エラーログミドルウェア
function errorLogger(err, req, res, next) {
    const responseTime = calculateResponseTime(req);
    
    const errorData = {
        error: {
            message: err.message,
            stack: err.stack,
            name: err.name,
            code: err.code
        },
        request: {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent'],
            authenticated: req.authenticated || false,
            username: req.user?.username || 'anonymous',
            sessionId: req.sessionID
        },
        responseTime: responseTime,
        timestamp: new Date().toISOString()
    };
    
    // エラーの種類に応じたログレベル
    if (err.statusCode >= 500 || !err.statusCode) {
        logger.error('Unhandled application error', err, errorData);
    } else if (err.statusCode >= 400) {
        logger.warn('Client error', errorData);
    } else {
        logger.info('Application error', errorData);
    }
    
    // セキュリティ関連エラーの場合は別途記録
    if (err.name === 'ValidationError' || err.name === 'AuthenticationError' || err.name === 'AuthorizationError') {
        logger.security(`Security-related error: ${err.name}`, {
            ...errorData,
            severity: 'MEDIUM',
            securityEvent: err.name.toLowerCase().replace('error', '_failure')
        });
    }
    
    next(err);
}

// アクセス統計ミドルウェア（将来の分析用）
function accessStatsLogger(req, res, next) {
    // 統計情報の収集（本番環境でのみ）
    if (process.env.NODE_ENV === 'production') {
        const statsData = {
            endpoint: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0], // 日付のみ
            hour: new Date().getHours(),
            authenticated: req.authenticated || false
        };
        
        // 統計ログは別ファイルに出力することも可能
        logger.info('Access stats', {
            type: 'access_stats',
            ...statsData
        });
    }
    
    next();
}

// パフォーマンス監視ミドルウェア
function performanceLogger(req, res, next) {
    const startMemory = process.memoryUsage();
    const startCpuUsage = process.cpuUsage();
    
    // レスポンス完了時の処理
    const originalEnd = res.end;
    res.end = function(...args) {
        const endMemory = process.memoryUsage();
        const endCpuUsage = process.cpuUsage(startCpuUsage);
        const responseTime = calculateResponseTime(req);
        
        const performanceData = {
            responseTime: responseTime,
            memory: {
                heapUsed: endMemory.heapUsed - startMemory.heapUsed,
                heapTotal: endMemory.heapTotal,
                external: endMemory.external,
                rss: endMemory.rss
            },
            cpu: {
                user: endCpuUsage.user,
                system: endCpuUsage.system
            },
            endpoint: req.originalUrl,
            method: req.method,
            statusCode: res.statusCode
        };
        
        // パフォーマンス問題の検出
        if (responseTime > 10000) { // 10秒以上
            logger.warn('Very slow request detected', performanceData);
        } else if (responseTime > 5000) { // 5秒以上
            logger.performance('Slow request', performanceData);
        }
        
        // メモリ使用量の監視
        if (endMemory.heapUsed > 100 * 1024 * 1024) { // 100MB以上
            logger.warn('High memory usage detected', performanceData);
        }
        
        originalEnd.apply(this, args);
    };
    
    next();
}

// ヘルスチェック用の軽量ログ
function healthCheckLogger(req, res, next) {
    // ヘルスチェックエンドポイントは詳細ログをスキップ
    if (req.originalUrl === '/health' || req.originalUrl === '/ping') {
        const simpleLog = {
            method: req.method,
            url: req.originalUrl,
            timestamp: new Date().toISOString()
        };
        
        logger.debug('Health check request', simpleLog);
        return next();
    }
    
    next();
}

module.exports = {
    requestTimer,
    requestLogger,
    errorLogger,
    accessStatsLogger,
    performanceLogger,
    healthCheckLogger,
    
    // ユーティリティ関数
    calculateResponseTime,
    classifySecurityEvent,
    getSeverityLevel,
    getSecurityEventDescription
};