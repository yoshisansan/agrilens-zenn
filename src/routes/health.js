const express = require('express');
const router = express.Router();

// サービス
const aiService = require('../services/aiService');
const geeService = require('../services/geeService');

// ユーティリティ
const { asyncHandler } = require('../utils/errors');
const logger = require('../utils/logger');

// 基本ヘルスチェック
router.get('/',
    asyncHandler(async (req, res) => {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            environment: process.env.NODE_ENV || 'development'
        };

        res.json(health);
    })
);

// 詳細ヘルスチェック
router.get('/detailed',
    asyncHandler(async (req, res) => {
        const startTime = Date.now();

        try {
            // 各サービスのヘルスチェックを並列実行
            const [aiHealth, geeHealth, systemHealth] = await Promise.allSettled([
                aiService.healthCheck(),
                geeService.healthCheck(),
                getSystemHealth()
            ]);

            const responseTime = Date.now() - startTime;

            // 全体のステータス判定
            const overallStatus = determineOverallStatus([
                aiHealth.status === 'fulfilled' ? aiHealth.value.status : 'unhealthy',
                geeHealth.status === 'fulfilled' ? geeHealth.value.status : 'unhealthy',
                systemHealth.status === 'fulfilled' ? systemHealth.value.status : 'unhealthy'
            ]);

            const health = {
                status: overallStatus,
                timestamp: new Date().toISOString(),
                responseTime: responseTime,
                services: {
                    ai: aiHealth.status === 'fulfilled' ? aiHealth.value : { 
                        status: 'unhealthy', 
                        error: aiHealth.reason?.message || 'Service check failed' 
                    },
                    earthEngine: geeHealth.status === 'fulfilled' ? geeHealth.value : { 
                        status: 'unhealthy', 
                        error: geeHealth.reason?.message || 'Service check failed' 
                    },
                    system: systemHealth.status === 'fulfilled' ? systemHealth.value : { 
                        status: 'unhealthy', 
                        error: systemHealth.reason?.message || 'System check failed' 
                    }
                }
            };

            const statusCode = overallStatus === 'healthy' ? 200 : 
                              overallStatus === 'degraded' ? 200 : 503;

            res.status(statusCode).json(health);

        } catch (error) {
            logger.error('Health check failed', error);
            
            res.status(503).json({
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    })
);

// システムヘルスチェック
async function getSystemHealth() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // メモリ使用量チェック（MB）
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
    const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;

    // ステータス判定
    let status = 'healthy';
    const issues = [];

    if (memoryUsagePercent > 90) {
        status = 'unhealthy';
        issues.push('High memory usage');
    } else if (memoryUsagePercent > 70) {
        status = 'degraded';
        issues.push('Elevated memory usage');
    }

    if (process.uptime() < 10) {
        issues.push('Recently started');
    }

    return {
        status: status,
        uptime: process.uptime(),
        memory: {
            heapUsed: Math.round(heapUsedMB),
            heapTotal: Math.round(heapTotalMB),
            usagePercent: Math.round(memoryUsagePercent),
            rss: Math.round(memoryUsage.rss / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024)
        },
        cpu: {
            user: cpuUsage.user,
            system: cpuUsage.system
        },
        nodeVersion: process.version,
        platform: process.platform,
        issues: issues.length > 0 ? issues : undefined,
        timestamp: new Date().toISOString()
    };
}

// 全体ステータスの判定
function determineOverallStatus(statuses) {
    if (statuses.includes('unhealthy')) {
        return 'unhealthy';
    }
    if (statuses.includes('degraded')) {
        return 'degraded';
    }
    return 'healthy';
}

// Ping エンドポイント（軽量チェック）
router.get('/ping',
    (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString()
        });
    }
);

// Readiness チェック（Kubernetes用）
router.get('/ready',
    asyncHandler(async (req, res) => {
        try {
            // 重要なサービスの簡易チェック
            const aiAvailable = await aiService.healthCheck().then(h => h.status !== 'unhealthy').catch(() => false);
            const geeAvailable = await geeService.healthCheck().then(h => h.status !== 'unhealthy').catch(() => false);

            // どちらかが利用可能ならready
            const ready = aiAvailable || geeAvailable;

            if (ready) {
                res.json({
                    status: 'ready',
                    services: {
                        ai: aiAvailable,
                        earthEngine: geeAvailable
                    },
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(503).json({
                    status: 'not_ready',
                    reason: 'No essential services available',
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            res.status(503).json({
                status: 'not_ready',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    })
);

// Liveness チェック（Kubernetes用）
router.get('/live',
    (req, res) => {
        // プロセスが生きているかの基本チェック
        const alive = process.uptime() > 0;
        
        if (alive) {
            res.json({
                status: 'alive',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                status: 'dead',
                timestamp: new Date().toISOString()
            });
        }
    }
);

module.exports = router;