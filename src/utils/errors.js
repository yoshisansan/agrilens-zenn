const logger = require('./logger');

// ベースエラークラス
class BaseError extends Error {
    constructor(message, code, statusCode = 500, details = null) {
        super(message);
        this.name = this.constructor.name;
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.timestamp = new Date().toISOString();
        
        // スタックトレースの改善
        Error.captureStackTrace(this, this.constructor);
    }
    
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            timestamp: this.timestamp,
            details: this.details
        };
    }
}

// バリデーションエラー
class ValidationError extends BaseError {
    constructor(message, errors = [], details = null) {
        super(message, 'VALIDATION_ERROR', 400, details);
        this.errors = errors;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            errors: this.errors
        };
    }
}

// 認証エラー
class AuthenticationError extends BaseError {
    constructor(message = '認証が必要です', details = null) {
        super(message, 'AUTHENTICATION_ERROR', 401, details);
    }
}

// 認可エラー
class AuthorizationError extends BaseError {
    constructor(message = '権限が不足しています', requiredRole = null, details = null) {
        super(message, 'AUTHORIZATION_ERROR', 403, details);
        this.requiredRole = requiredRole;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            requiredRole: this.requiredRole
        };
    }
}

// レート制限エラー
class RateLimitError extends BaseError {
    constructor(message = 'レート制限に達しました', retryAfter = null, details = null) {
        super(message, 'RATE_LIMIT_ERROR', 429, details);
        this.retryAfter = retryAfter;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            retryAfter: this.retryAfter
        };
    }
}

// リソースが見つからないエラー
class NotFoundError extends BaseError {
    constructor(resource = 'リソース', message = null, details = null) {
        const errorMessage = message || `${resource}が見つかりません`;
        super(errorMessage, 'NOT_FOUND_ERROR', 404, details);
        this.resource = resource;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            resource: this.resource
        };
    }
}

// 競合エラー
class ConflictError extends BaseError {
    constructor(message = 'リソースが競合しています', details = null) {
        super(message, 'CONFLICT_ERROR', 409, details);
    }
}

// 外部API呼び出しエラー
class ExternalAPIError extends BaseError {
    constructor(service, originalError, details = null) {
        const message = `${service}APIでエラーが発生しました: ${originalError.message}`;
        super(message, 'EXTERNAL_API_ERROR', 502, details);
        this.service = service;
        this.originalError = originalError;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            service: this.service,
            originalError: {
                message: this.originalError.message,
                name: this.originalError.name
            }
        };
    }
}

// データベースエラー
class DatabaseError extends BaseError {
    constructor(operation, originalError, details = null) {
        const message = `データベース操作（${operation}）でエラーが発生しました`;
        super(message, 'DATABASE_ERROR', 500, details);
        this.operation = operation;
        this.originalError = originalError;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            operation: this.operation,
            originalError: {
                message: this.originalError.message,
                name: this.originalError.name
            }
        };
    }
}

// セキュリティエラー
class SecurityError extends BaseError {
    constructor(threat, message = null, details = null) {
        const errorMessage = message || `セキュリティ脅威が検出されました: ${threat}`;
        super(errorMessage, 'SECURITY_ERROR', 403, details);
        this.threat = threat;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            threat: this.threat
        };
    }
}

// タイムアウトエラー
class TimeoutError extends BaseError {
    constructor(operation, timeout, details = null) {
        const message = `操作（${operation}）がタイムアウトしました（${timeout}ms）`;
        super(message, 'TIMEOUT_ERROR', 408, details);
        this.operation = operation;
        this.timeout = timeout;
    }
    
    toJSON() {
        return {
            ...super.toJSON(),
            operation: this.operation,
            timeout: this.timeout
        };
    }
}

// エラーレスポンス生成関数
function createErrorResponse(error, req = null) {
    // デフォルトエラー情報
    const errorResponse = {
        error: true,
        message: 'サーバー内部エラーが発生しました',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date().toISOString()
    };
    
    // カスタムエラーの場合
    if (error instanceof BaseError) {
        errorResponse.message = error.message;
        errorResponse.code = error.code;
        errorResponse.timestamp = error.timestamp;
        
        // 詳細情報の追加（開発環境のみ）
        if (process.env.NODE_ENV === 'development') {
            errorResponse.details = error.details;
            errorResponse.stack = error.stack;
        }
        
        // エラータイプ固有の情報
        if (error instanceof ValidationError) {
            errorResponse.errors = error.errors;
        } else if (error instanceof AuthorizationError) {
            errorResponse.requiredRole = error.requiredRole;
        } else if (error instanceof RateLimitError) {
            errorResponse.retryAfter = error.retryAfter;
        } else if (error instanceof NotFoundError) {
            errorResponse.resource = error.resource;
        }
    } else {
        // 標準エラーの場合
        if (process.env.NODE_ENV === 'development') {
            errorResponse.message = error.message;
            errorResponse.stack = error.stack;
        }
    }
    
    // リクエスト情報の追加（セキュリティログ用）
    if (req) {
        const requestInfo = {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            authenticated: req.authenticated || false,
            username: req.user?.username || 'anonymous'
        };
        
        // セキュリティ関連エラーの場合は詳細ログ
        if (error instanceof SecurityError || 
            error instanceof AuthenticationError || 
            error instanceof AuthorizationError ||
            error instanceof ValidationError) {
            
            logger.security('Security-related error occurred', {
                error: error.toJSON ? error.toJSON() : error.message,
                request: requestInfo,
                severity: getSeverityLevel(error)
            });
        }
    }
    
    return errorResponse;
}

// エラーの重要度レベル判定
function getSeverityLevel(error) {
    if (error instanceof SecurityError) {
        return 'HIGH';
    } else if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        return 'MEDIUM';
    } else if (error instanceof ValidationError) {
        return 'LOW';
    } else if (error instanceof ExternalAPIError || error instanceof DatabaseError) {
        return 'MEDIUM';
    } else if (error instanceof TimeoutError) {
        return 'LOW';
    } else {
        return 'MEDIUM';
    }
}

// Express エラーハンドリングミドルウェア
function errorHandler(err, req, res, next) {
    // エラーログの記録
    const severity = getSeverityLevel(err);
    const logData = {
        error: err.toJSON ? err.toJSON() : {
            name: err.name,
            message: err.message,
            stack: err.stack
        },
        request: {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            authenticated: req.authenticated || false,
            username: req.user?.username || 'anonymous'
        },
        severity: severity
    };
    
    if (severity === 'HIGH') {
        logger.error('High severity error occurred', err, logData);
    } else if (severity === 'MEDIUM') {
        logger.warn('Medium severity error occurred', logData);
    } else {
        logger.info('Low severity error occurred', logData);
    }
    
    // エラーレスポンスの生成
    const errorResponse = createErrorResponse(err, req);
    const statusCode = err.statusCode || 500;
    
    // レスポンスの送信
    res.status(statusCode).json(errorResponse);
}

// 非同期エラーのキャッチャー
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// エラー詳細の安全な取得（機密情報の除去）
function getSafeErrorDetails(error) {
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'private'];
    
    function sanitizeObject(obj) {
        if (!obj || typeof obj !== 'object') {
            return obj;
        }
        
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
            
            if (isSensitive) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object') {
                sanitized[key] = sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
    
    return sanitizeObject(error);
}

// よく使われるエラー生成のヘルパー関数
const ErrorHelpers = {
    // バリデーションエラー
    validation: (message, errors = []) => new ValidationError(message, errors),
    
    // 認証エラー
    auth: (message) => new AuthenticationError(message),
    
    // 認可エラー
    forbidden: (message, requiredRole) => new AuthorizationError(message, requiredRole),
    
    // 見つからないエラー
    notFound: (resource) => new NotFoundError(resource),
    
    // レート制限エラー
    rateLimit: (retryAfter) => new RateLimitError('レート制限に達しました', retryAfter),
    
    // 外部APIエラー
    externalAPI: (service, originalError) => new ExternalAPIError(service, originalError),
    
    // セキュリティエラー
    security: (threat, message) => new SecurityError(threat, message),
    
    // タイムアウトエラー
    timeout: (operation, timeout) => new TimeoutError(operation, timeout)
};

module.exports = {
    // エラークラス
    BaseError,
    ValidationError,
    AuthenticationError,
    AuthorizationError,
    RateLimitError,
    NotFoundError,
    ConflictError,
    ExternalAPIError,
    DatabaseError,
    SecurityError,
    TimeoutError,
    
    // ユーティリティ関数
    createErrorResponse,
    getSeverityLevel,
    errorHandler,
    asyncHandler,
    getSafeErrorDetails,
    
    // ヘルパー関数
    ErrorHelpers
};