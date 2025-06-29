const config = require('./index');

// セキュリティ関連の設定を一元管理
const securityConfig = {
    // レート制限設定
    rateLimit: {
        // AI APIエンドポイント用
        aiApi: {
            windowMs: 60 * 1000, // 1分間
            max: 3, // 最大3リクエスト/分/IP
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                error: 'AI APIのレート制限に達しました',
                retryAfter: '1分後に再試行してください',
                code: 'RATE_LIMIT_AI'
            },
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        },
        
        // 分析APIエンドポイント用
        analysisApi: {
            windowMs: 60 * 1000, // 1分間
            max: 3, // 最大3リクエスト/分/IP
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                error: '分析APIのレート制限に達しました',
                retryAfter: '1分後に再試行してください',
                code: 'RATE_LIMIT_ANALYSIS'
            },
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        },
        
        // 認証APIエンドポイント用
        authApi: {
            windowMs: 60 * 1000, // 1分間
            max: 5, // 最大5リクエスト/分/IP
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                error: '認証APIのレート制限に達しました',
                retryAfter: '1分後に再試行してください',
                code: 'RATE_LIMIT_AUTH'
            },
            skipSuccessfulRequests: true, // 成功したリクエストはカウントしない
            skipFailedRequests: false
        },
        
        // 一般的なAPIエンドポイント用
        general: {
            windowMs: 15 * 60 * 1000, // 15分間
            max: 100, // 最大100リクエスト/15分/IP
            standardHeaders: true,
            legacyHeaders: false,
            message: {
                error: 'レート制限に達しました',
                retryAfter: '15分後に再試行してください',
                code: 'RATE_LIMIT_GENERAL'
            },
            skipSuccessfulRequests: false,
            skipFailedRequests: false
        }
    },
    
    // Helmet設定 (セキュリティヘッダー)
    helmet: {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "'unsafe-inline'", // インラインスクリプト許可（開発用）
                    "'unsafe-eval'", // eval許可（開発用）
                    "https://unpkg.com",
                    "https://cdn.jsdelivr.net",
                    "https://cdnjs.cloudflare.com",
                    "https://cdn.tailwindcss.com"
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://unpkg.com",
                    "https://cdn.jsdelivr.net",
                    "https://cdnjs.cloudflare.com"
                ],
                imgSrc: [
                    "'self'",
                    "data:",
                    "https:",
                    "http:" // タイルマップ用
                ],
                connectSrc: [
                    "'self'",
                    "https://generativelanguage.googleapis.com",
                    "https://aiplatform.googleapis.com",
                    "https://earthengine.googleapis.com",
                    "https://*.googleapis.com"
                ],
                fontSrc: ["'self'", "https:", "data:"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"]
            }
        },
        crossOriginEmbedderPolicy: false, // Google Earth Engine APIとの互換性のため
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    },
    
    // セッション設定
    session: {
        secret: config.sessionSecret,
        resave: false,
        saveUninitialized: false,
        rolling: true, // セッション延長
        cookie: {
            secure: config.isProduction(), // HTTPSでのみ送信
            httpOnly: true, // XSS対策
            maxAge: 24 * 60 * 60 * 1000, // 24時間
            sameSite: config.isProduction() ? 'strict' : 'lax' // CSRF対策
        },
        name: 'agrilens.sid' // デフォルトのセッション名を変更
    },
    
    // 入力検証設定
    validation: {
        // プロンプト検証
        prompt: {
            maxLength: 5000,
            minLength: 1,
            allowedCharacters: /^[\s\S]*$/, // 全文字許可
            forbiddenPatterns: [
                /ignore\s+previous\s+instructions/i,
                /system\s*:\s*/i,
                /assistant\s*:\s*/i,
                /<script/i,
                /javascript:/i,
                /eval\s*\(/i,
                /function\s*\(/i
            ]
        },
        
        // GeoJSON検証
        geoJson: {
            maxCoordinates: 1000, // 最大座標数
            maxNesting: 10, // 最大ネスト階層
            allowedTypes: ['Polygon', 'Point', 'LineString'],
            maxBounds: {
                lat: { min: -90, max: 90 },
                lng: { min: -180, max: 180 }
            }
        },
        
        // ファイルアップロード（将来用）
        file: {
            maxSize: 10 * 1024 * 1024, // 10MB
            allowedTypes: ['image/jpeg', 'image/png', 'application/json'],
            maxFiles: 5
        }
    },
    
    // ログ設定（セキュリティイベント）
    securityLogging: {
        events: {
            authFailure: true,
            rateLimitHit: true,
            validationFailure: true,
            suspiciousActivity: true,
            serverError: true
        },
        sensitiveFields: [
            'password',
            'apiKey',
            'token',
            'secret',
            'privateKey',
            'authorization'
        ]
    },
    
    // タイムアウト設定
    timeouts: {
        api: {
            ai: 30000, // 30秒
            earthEngine: 60000, // 60秒
            general: 10000 // 10秒
        },
        request: {
            body: 5000, // 5秒
            header: 1000 // 1秒
        }
    },
    
    // 本番環境専用設定
    production: {
        requireHttps: true,
        trustProxy: true,
        logLevel: 'warn',
        enableCors: false,
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || []
    },
    
    // 開発環境専用設定
    development: {
        requireHttps: false,
        trustProxy: false,
        logLevel: 'debug',
        enableCors: true,
        allowedOrigins: '*'
    },
    
    // 環境に応じた設定取得
    getEnvironmentConfig() {
        return config.isProduction() ? this.production : this.development;
    },
    
    // セキュリティレベル判定
    getSecurityLevel() {
        if (config.isProduction()) {
            return 'strict';
        } else if (config.env === 'staging') {
            return 'moderate';
        } else {
            return 'relaxed';
        }
    }
};

module.exports = securityConfig;