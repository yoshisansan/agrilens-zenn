#!/usr/bin/env node

// 新しいセキュアなサーバーエントリーポイント
const App = require('./src/app');
const config = require('./src/config');
const logger = require('./src/utils/logger');

// アプリケーションの起動
async function startServer() {
    try {
        logger.info('Starting AgriLens server', {
            nodeVersion: process.version,
            environment: config.env,
            pid: process.pid
        });

        // 設定の検証
        config.validate();

        // アプリケーションインスタンスの作成
        const app = new App();

        // サーバー起動
        const server = await app.start(config.port);

        // 起動完了ログ
        logger.info('AgriLens server startup completed', {
            port: config.port,
            host: config.host,
            pid: process.pid,
            uptime: process.uptime()
        });

        return server;

    } catch (error) {
        logger.error('Failed to start AgriLens server', error);
        process.exit(1);
    }
}

// メイン実行
if (require.main === module) {
    startServer().catch(error => {
        console.error('Startup failed:', error);
        process.exit(1);
    });
}

module.exports = startServer;