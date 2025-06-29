const dotenv = require('dotenv');
const path = require('path');

// 環境変数ファイルを読み込み
dotenv.config();

// 設定値検証関数
function validateConfig() {
    const requiredEnvVars = {
        development: [],
        production: ['GOOGLE_PROJECT_ID', 'GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY']
    };
    
    const env = process.env.NODE_ENV || 'development';
    const required = requiredEnvVars[env] || [];
    
    const missing = required.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
        console.warn(`警告: 以下の環境変数が設定されていません: ${missing.join(', ')}`);
        if (env === 'production') {
            throw new Error(`本番環境では必須の環境変数が不足しています: ${missing.join(', ')}`);
        }
    }
}

// 環境変数の型変換とデフォルト値設定
function getEnvVar(name, defaultValue = null, type = 'string') {
    const value = process.env[name];
    
    if (value === undefined || value === '') {
        if (defaultValue !== null) {
            return defaultValue;
        }
        return null;
    }
    
    switch (type) {
        case 'number':
            const num = parseInt(value, 10);
            return isNaN(num) ? defaultValue : num;
        case 'boolean':
            return value.toLowerCase() === 'true';
        case 'array':
            return value.split(',').map(item => item.trim());
        default:
            return value;
    }
}

// 環境変数の一元管理
const config = {
    // 基本設定
    env: process.env.NODE_ENV || 'development',
    port: getEnvVar('PORT', 3000, 'number'),
    host: getEnvVar('HOST', 'localhost'),
    
    // セキュリティ設定（デモ版では認証をスキップ）
    skipAuth: process.env.SKIP_AUTH === 'true' || true, // デモ版では常にtrue
    
    // セキュリティ設定
    sessionSecret: getEnvVar('SESSION_SECRET', require('crypto').randomBytes(64).toString('hex')),
    trustProxy: getEnvVar('TRUST_PROXY', false, 'boolean'),
    
    // Google Cloud / Earth Engine設定
    google: {
        projectId: getEnvVar('GOOGLE_PROJECT_ID'),
        clientId: getEnvVar('GOOGLE_CLIENT_ID'),
        clientSecret: getEnvVar('GOOGLE_CLIENT_SECRET'),
        redirectUri: getEnvVar('GOOGLE_REDIRECT_URI'),
        privateKey: getEnvVar('GOOGLE_PRIVATE_KEY'),
        privateKeyId: getEnvVar('GOOGLE_PRIVATE_KEY_ID'),
        clientEmail: getEnvVar('GOOGLE_CLIENT_EMAIL'),
        privateKeyPath: getEnvVar('GOOGLE_PRIVATE_KEY_PATH'),
        cloudRegion: getEnvVar('GOOGLE_CLOUD_REGION', 'asia-northeast1'),
        serviceAccountClientId: getEnvVar('GOOGLE_SERVICE_ACCOUNT_CLIENT_ID')
    },
    
    // AI設定
    ai: {
        provider: getEnvVar('AI_API_PROVIDER', 'gemini-direct'),
        model: getEnvVar('AI_MODEL', 'gemini-1.5-flash'),
        geminiApiKey: getEnvVar('GEMINI_API_KEY'),
        timeout: getEnvVar('AI_TIMEOUT', 30000, 'number'),
        maxRetries: getEnvVar('AI_MAX_RETRIES', 3, 'number')
    },
    
    // データベース設定（将来の拡張用）
    database: {
        redis: {
            host: getEnvVar('REDIS_HOST', 'localhost'),
            port: getEnvVar('REDIS_PORT', 6379, 'number'),
            password: getEnvVar('REDIS_PASSWORD'),
            enabled: getEnvVar('REDIS_ENABLED', false, 'boolean')
        }
    },
    
    // CORS設定
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? [process.env.PRODUCTION_URL, /\.run\.app$/] 
            : true,
        credentials: true
    },
    
    // ログ設定
    logging: {
        level: getEnvVar('LOG_LEVEL', 'info'),
        format: getEnvVar('LOG_FORMAT', 'json'),
        file: getEnvVar('LOG_FILE', 'logs/app.log'),
        maxSize: getEnvVar('LOG_MAX_SIZE', '10m'),
        maxFiles: getEnvVar('LOG_MAX_FILES', 5, 'number')
    },
    
    // 開発/本番の判定
    isDevelopment: () => config.env === 'development',
    isProduction: () => config.env === 'production',
    isTest: () => config.env === 'test',
    
    // 設定値の検証
    validate: validateConfig
};

// 設定の初期化時に検証実行
try {
    config.validate();
} catch (error) {
    console.error('設定エラー:', error.message);
    if (config.isProduction()) {
        process.exit(1);
    }
}

module.exports = config;