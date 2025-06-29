const winston = require('winston');
const path = require('path');
const config = require('../config');
const securityConfig = require('../config/security');

// ログディレクトリの作成
const fs = require('fs');
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// カスタムフォーマット関数
const customFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
        let logMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
        
        // メタデータがある場合は追加
        if (Object.keys(meta).length > 0) {
            logMessage += ' ' + JSON.stringify(meta, null, 2);
        }
        
        return logMessage;
    })
);

// JSON形式のフォーマット（本番環境用）
const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// センシティブ情報をマスクするフィルター
const sensitiveDataFilter = winston.format((info) => {
    if (typeof info.message === 'object') {
        info.message = maskSensitiveData(info.message);
    }
    
    // メタデータからもセンシティブ情報を除去
    Object.keys(info).forEach(key => {
        if (typeof info[key] === 'object' && info[key] !== null) {
            info[key] = maskSensitiveData(info[key]);
        }
    });
    
    return info;
});

// センシティブデータマスキング関数
function maskSensitiveData(obj) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    
    const masked = { ...obj };
    const sensitiveFields = securityConfig.securityLogging.sensitiveFields;
    
    sensitiveFields.forEach(field => {
        if (masked[field]) {
            if (typeof masked[field] === 'string') {
                // 最初の3文字と最後の3文字以外をマスク
                const value = masked[field];
                if (value.length > 6) {
                    masked[field] = value.substring(0, 3) + '*'.repeat(value.length - 6) + value.substring(value.length - 3);
                } else {
                    masked[field] = '*'.repeat(value.length);
                }
            } else {
                masked[field] = '[MASKED]';
            }
        }
    });
    
    // ネストされたオブジェクトも処理
    Object.keys(masked).forEach(key => {
        if (typeof masked[key] === 'object' && masked[key] !== null) {
            masked[key] = maskSensitiveData(masked[key]);
        }
    });
    
    return masked;
}

// ログレベル設定
const logLevel = config.logging.level;

// トランスポート設定
const transports = [
    // コンソール出力
    new winston.transports.Console({
        level: logLevel,
        format: config.isProduction() ? jsonFormat : customFormat,
        handleExceptions: true,
        handleRejections: true
    })
];

// ファイル出力（本番環境）
if (config.isProduction() || process.env.LOG_TO_FILE === 'true') {
    // 一般ログファイル
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'app.log'),
            level: 'info',
            format: winston.format.combine(
                sensitiveDataFilter(),
                jsonFormat
            ),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        })
    );
    
    // エラーログファイル
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: winston.format.combine(
                sensitiveDataFilter(),
                jsonFormat
            ),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        })
    );
    
    // セキュリティログファイル
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'security.log'),
            level: 'warn',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    return JSON.stringify({
                        timestamp,
                        level,
                        message,
                        type: 'security',
                        ...meta
                    });
                })
            ),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 10,
            tailable: true
        })
    );
}

// Winstonロガー作成
const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
        sensitiveDataFilter(),
        winston.format.timestamp()
    ),
    transports: transports,
    exitOnError: false
});

// カスタムメソッド追加
logger.security = function(message, meta = {}) {
    this.warn(message, {
        ...meta,
        type: 'security',
        timestamp: new Date().toISOString(),
        pid: process.pid
    });
};

logger.audit = function(message, meta = {}) {
    this.info(message, {
        ...meta,
        type: 'audit',
        timestamp: new Date().toISOString(),
        pid: process.pid
    });
};

logger.performance = function(message, meta = {}) {
    this.info(message, {
        ...meta,
        type: 'performance',
        timestamp: new Date().toISOString(),
        pid: process.pid
    });
};

// リクエストログ用のフォーマッタ
logger.request = function(req, res, responseTime) {
    const logData = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: responseTime,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        contentLength: res.get('content-length') || 0,
        timestamp: new Date().toISOString()
    };
    
    // エラーレスポンスの場合は警告レベル
    if (res.statusCode >= 400) {
        this.warn('Request completed with error', logData);
    } else {
        this.info('Request completed', logData);
    }
};

// エラーログ用のフォーマッタ
logger.error = function(message, error = null, meta = {}) {
    const errorData = {
        message: message,
        ...meta,
        timestamp: new Date().toISOString(),
        pid: process.pid
    };
    
    if (error) {
        errorData.error = {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        };
    }
    
    // winston の標準 error メソッドを使用
    if (this.transports && this.transports.length > 0) {
        this.log('error', errorData);
    } else {
        console.error('[ERROR]', JSON.stringify(errorData, null, 2));
    }
};

// 開発環境でのデバッグ情報
if (config.isDevelopment()) {
    logger.debug('Logger initialized', {
        level: logLevel,
        transports: transports.length,
        environment: config.env
    });
}

module.exports = logger;