const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const path = require('path');

// 設定とユーティリティ
const config = require('./config');
const securityConfig = require('./config/security');
const logger = require('./utils/logger');
const { errorHandler } = require('./utils/errors');

// ミドルウェア
const { requestTimer, healthCheckLogger } = require('./middleware/logging');

// ルート
const apiRoutes = require('./routes/api');

class App {
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // セキュリティヘッダー設定
        this.app.use(helmet(securityConfig.helmet));

        // CORS設定
        this.app.use(cors(config.cors));

        // プロキシ信頼設定
        if (config.isProduction()) {
            this.app.set('trust proxy', 1);
        }

        // リクエストタイマー
        this.app.use(requestTimer);

        // ヘルスチェック用の軽量ログ
        this.app.use(healthCheckLogger);

        // JSONボディパーサー
        this.app.use(express.json({ 
            limit: '10mb',
            strict: true
        }));

        // URLエンコードされたボディパーサー
        this.app.use(express.urlencoded({ 
            extended: true, 
            limit: '10mb' 
        }));

        // セッション設定
        this.app.use(session(securityConfig.session));

        // 静的ファイル配信
        this.app.use(express.static(path.join(__dirname, '../'), {
            dotfiles: 'deny',
            index: false,
            redirect: false,
            setHeaders: (res, path) => {
                if (path.endsWith('.css') || path.endsWith('.js')) {
                    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                    res.setHeader('Pragma', 'no-cache');
                    res.setHeader('Expires', '0');
                }
            }
        }));

        logger.info('Middleware setup completed');
    }

    setupRoutes() {
        // API ルート
        this.app.use('/api', apiRoutes);

        // ルートページ
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../index.html'));
        });

        // 404 ハンドラー
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: true,
                code: 'NOT_FOUND',
                message: 'エンドポイントが見つかりません',
                path: req.originalUrl,
                timestamp: new Date().toISOString()
            });
        });

        logger.info('Routes setup completed');
    }

    setupErrorHandling() {
        // エラーハンドラー
        this.app.use(errorHandler);

        // 未処理の例外キャッチ
        process.on('uncaughtException', (err) => {
            logger.error('Uncaught exception occurred', err);
            
            // 開発環境以外では終了
            if (!config.isDevelopment()) {
                process.exit(1);
            }
        });

        // 未処理のPromiseリジェクション
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled promise rejection', new Error(reason), {
                promise: promise.toString()
            });
            
            // 開発環境以外では終了
            if (!config.isDevelopment()) {
                process.exit(1);
            }
        });

        // グレースフルシャットダウン
        ['SIGTERM', 'SIGINT'].forEach(signal => {
            process.on(signal, () => {
                logger.info(`Received ${signal}, starting graceful shutdown`);
                
                // サーバーがある場合は停止
                if (this.server) {
                    this.server.close(() => {
                        logger.info('Server closed successfully');
                        process.exit(0);
                    });
                } else {
                    process.exit(0);
                }
            });
        });

        logger.info('Error handling setup completed');
    }

    // サーバー起動
    start(port = config.port) {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(port, () => {
                    logger.info(`Server started successfully`, {
                        port: port,
                        environment: config.env,
                        nodeVersion: process.version,
                        timestamp: new Date().toISOString()
                    });

                    this.displayStartupInfo(port);
                    resolve(this.server);
                });

                this.server.on('error', (err) => {
                    if (err.code === 'EADDRINUSE') {
                        logger.error(`Port ${port} is already in use. Trying port ${port + 1}`, err);
                        // 別のポートで再試行
                        this.start(port + 1).then(resolve).catch(reject);
                    } else {
                        logger.error('Server startup error', err);
                        reject(err);
                    }
                });

            } catch (error) {
                logger.error('Failed to start server', error);
                reject(error);
            }
        });
    }

    // 起動情報の表示
    displayStartupInfo(port) {
        const info = {
            server: {
                url: `http://${config.host}:${port}`,
                environment: config.env,
                version: process.env.npm_package_version || '1.0.0'
            },
            api: {
                base: `/api`,
                endpoints: {
                    health: `/api/health`,
                    ai: `/api/ai`,
                    analysis: `/api/analysis`,
                    auth: `/api/auth`
                }
            },
            features: {
                security: {
                    rateLimit: true,
                    validation: true,
                    authentication: true,
                    logging: true
                },
                services: {
                    aiService: 'available',
                    earthEngine: 'available',
                    mockData: 'fallback'
                }
            }
        };

        logger.info('AgriLens server ready', info);

        // 開発環境での追加情報
        if (config.isDevelopment()) {
            console.log(`
🌱 AgriLens Server Started
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 URL: http://${config.host}:${port}
🔧 Environment: ${config.env}
📊 API: http://${config.host}:${port}/api
🏥 Health: http://${config.host}:${port}/api/health
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            `);
        }
    }

    // サーバー停止
    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    logger.info('Server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // Express アプリインスタンスの取得
    getApp() {
        return this.app;
    }
}

module.exports = App;