const geeService = require('../services/geeService');
const config = require('../config');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errors');
const { validateGeoJSONCoordinates } = require('../utils/validators');

class AnalysisController {
    // 植生指標分析のメインエンドポイント
    analyzeVegetation = asyncHandler(async (req, res) => {
        const { aoiGeoJSON, dateStart, dateEnd } = req.body;
        const startTime = Date.now();

        // リクエストログ
        logger.info('Starting vegetation analysis', {
            hasAOI: !!aoiGeoJSON,
            dateRange: `${dateStart} to ${dateEnd}`,
            ip: req.ip,
            authenticated: req.authenticated
        });

        try {
            // デモ版では常にモックデータを使用
            if (config.skipAuth) {
                logger.info('Demo mode: Using mock data instead of real GEE analysis');
                const mockResult = geeService.generateMockData(aoiGeoJSON);
                
                // フロントエンドが期待する形式に変換
                const response = {
                    success: true,
                    dateRange: {
                        start: mockResult.metadata.date,
                        end: mockResult.metadata.date
                    },
                    stats: mockResult.statistics,
                    ndviTileUrlTemplate: mockResult.mapTiles.NDVI,
                    ndmiTileUrlTemplate: mockResult.mapTiles.NDMI,
                    ndreTileUrlTemplate: mockResult.mapTiles.NDRE,
                    dataSource: 'demo_mock_data',
                    notice: 'デモ版のため、モックデータを使用しています',
                    timestamp: new Date().toISOString()
                };
                
                res.json(response);
                return;
            }

            // 実際のGEE分析（本番環境用）
            let result;
            
            // GEE分析の実行
            try {
                result = await geeService.analyzeVegetationIndices(
                    aoiGeoJSON,
                    dateStart,
                    dateEnd,
                    ['NDVI', 'NDMI', 'NDRE']
                );
                
                logger.info('GEE analysis completed successfully');
                
            } catch (geeError) {
                logger.warn('Google Earth Engine unavailable, using mock data', {
                    error: geeError.message,
                    stack: geeError.stack
                });
                
                result = geeService.generateMockData(aoiGeoJSON);
                result.dataSource = 'mock_data';
            }

            // 結果の検証
            if (!result || !result.stats) {
                throw new ValidationError('分析結果の生成に失敗しました');
            }

            const responseTime = Date.now() - startTime;

            // レスポンス構築
            const response = {
                success: true,
                data: result,
                metadata: {
                    analysisDate: new Date().toISOString(),
                    dataSource: result.dataSource || 'gee',
                    requestId: req.id,
                    processingTime: Date.now() - req.startTime
                },
                timestamp: new Date().toISOString()
            };

            res.json(response);

            // 成功ログ
            logger.info('Vegetation analysis completed successfully', {
                dataSource: result.dataSource,
                imageDate: result.metadata.date,
                cloudCover: result.metadata.cloudCover,
                responseTime: responseTime,
                ip: req.ip
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;

            // エラーログ
            logger.error('Vegetation analysis failed', error, {
                ip: req.ip,
                requestBody: req.body
            });

            // エラーレスポンス
            res.status(error.statusCode || 500).json({
                error: true,
                message: error.message || '分析処理中にエラーが発生しました',
                code: error.code || 'ANALYSIS_ERROR',
                timestamp: new Date().toISOString(),
                details: error.details || null,
                ...(config.isDevelopment() && { stack: error.stack })
            });
        }
    });

    // 認証ステータスチェック（後方互換性用）
    getAuthStatus = asyncHandler(async (req, res) => {
        // 新しい認証システムでは常に認証済みとして扱う
        res.json({
            authenticated: req.authenticated || true,
            user: req.user || { username: 'authenticated-user' },
            timestamp: new Date().toISOString()
        });
    });

    // サーバー設定情報の取得
    getServerConfig = asyncHandler(async (req, res) => {
        try {
            const geeHealth = await geeService.healthCheck();
            
            const config = {
                services: {
                    googleEarthEngine: {
                        available: geeHealth.status === 'healthy',
                        status: geeHealth.status,
                        lastCheck: geeHealth.timestamp
                    }
                },
                analysis: {
                    supportedIndices: ['NDVI', 'NDMI', 'NDRE'],
                    supportedGeometries: ['Polygon', 'Point', 'LineString'],
                    defaultParams: {
                        cloudThreshold: 20,
                        scale: 10,
                        maxPixels: 1000000000
                    }
                },
                server: {
                    environment: process.env.NODE_ENV || 'development',
                    version: process.env.npm_package_version || '1.0.0',
                    capabilities: {
                        realTimeAnalysis: geeHealth.status === 'healthy',
                        mockDataFallback: true,
                        historicalData: true
                    }
                },
                timestamp: new Date().toISOString()
            };

            res.json(config);

        } catch (error) {
            logger.error('Failed to get server config', error);
            
            // エラーでも基本情報は返す
            res.json({
                services: {
                    googleEarthEngine: {
                        available: false,
                        status: 'unknown',
                        lastCheck: new Date().toISOString()
                    }
                },
                analysis: {
                    supportedIndices: ['NDVI', 'NDMI', 'NDRE'],
                    supportedGeometries: ['Polygon', 'Point', 'LineString'],
                    defaultParams: {
                        cloudThreshold: 20,
                        scale: 10,
                        maxPixels: 1000000000
                    }
                },
                server: {
                    environment: process.env.NODE_ENV || 'development',
                    version: process.env.npm_package_version || '1.0.0',
                    capabilities: {
                        realTimeAnalysis: false,
                        mockDataFallback: true,
                        historicalData: false
                    }
                },
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // 分析履歴の取得（将来の機能）
    getAnalysisHistory = asyncHandler(async (req, res) => {
        // 現在はモック実装
        const history = {
            analyses: [],
            total: 0,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10,
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            history: history,
            message: '履歴機能は今後実装予定です'
        });
    });

    // 分析エリアの検証
    validateAnalysisArea = asyncHandler(async (req, res) => {
        const { aoiGeoJSON } = req.body;

        try {
            // GeoJSONの検証
            const validation = validateGeoJSONCoordinates(aoiGeoJSON);
            
            if (validation.isValid) {
                // 面積計算（簡易版）
                const area = this.calculateApproximateArea(aoiGeoJSON);
                
                res.json({
                    valid: true,
                    area: area,
                    unit: 'square_meters',
                    recommendations: this.getAreaRecommendations(area),
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(400).json({
                    valid: false,
                    error: validation.error,
                    suggestions: [
                        '座標の形式を確認してください',
                        '座標数が制限内であることを確認してください',
                        'ジオメトリタイプがサポートされていることを確認してください'
                    ],
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            logger.error('Area validation failed', error);
            throw error;
        }
    });

    // 面積の概算計算
    calculateApproximateArea(geoJson) {
        if (geoJson.type === 'Point') {
            return 0; // 点は面積なし
        }

        if (geoJson.type === 'Polygon') {
            // 簡易的な面積計算（実際の球面計算ではない）
            const coordinates = geoJson.coordinates[0];
            if (coordinates.length < 4) return 0;

            let area = 0;
            for (let i = 0; i < coordinates.length - 1; i++) {
                const [x1, y1] = coordinates[i];
                const [x2, y2] = coordinates[i + 1];
                area += (x1 * y2) - (x2 * y1);
            }
            
            return Math.abs(area / 2) * 12309484; // 度から平方メートルへの概算変換
        }

        return 0; // その他のタイプ
    }

    // 面積に基づく推奨事項
    getAreaRecommendations(area) {
        if (area < 1000) { // 1000㎡未満
            return [
                '小規模な分析に適しています',
                '詳細な植生指標が取得できます'
            ];
        } else if (area < 100000) { // 10ha未満
            return [
                '中規模な農地分析に適しています',
                '適切な解像度で分析できます'
            ];
        } else if (area < 1000000) { // 100ha未満
            return [
                '大規模な農地分析です',
                '処理時間が長くなる可能性があります'
            ];
        } else {
            return [
                '非常に大規模な分析です',
                '分析エリアを分割することを推奨します',
                '処理時間が大幅に長くなる可能性があります'
            ];
        }
    }

    // 衛星データの利用可能性チェック
    checkDataAvailability = asyncHandler(async (req, res) => {
        const { aoiGeoJSON, startDate, endDate } = req.body;

        try {
            // 現在はモック実装
            const availability = {
                available: true,
                imageCount: Math.floor(Math.random() * 20) + 5,
                dateRange: {
                    start: startDate || '2024-01-01',
                    end: endDate || new Date().toISOString().split('T')[0]
                },
                averageCloudCover: Math.floor(Math.random() * 30) + 5,
                recommendations: [
                    '十分な画像データが利用可能です',
                    '良好な気象条件での撮影画像があります'
                ],
                timestamp: new Date().toISOString()
            };

            res.json({
                success: true,
                availability: availability
            });

        } catch (error) {
            logger.error('Data availability check failed', error);
            throw error;
        }
    });
}

module.exports = new AnalysisController();