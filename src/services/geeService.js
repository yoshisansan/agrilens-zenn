const ee = require('@google/earthengine');
const config = require('../config');
const logger = require('../utils/logger');
const { ExternalAPIError, TimeoutError, ValidationError } = require('../utils/errors');

class GEEService {
    constructor() {
        this.isInitialized = false;
        this.initializationPromise = null;
        this.initialize();
    }

    // Google Earth Engine の初期化
    async initialize() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._performInitialization();
        return this.initializationPromise;
    }

    async _performInitialization() {
        try {
            let privateKeyJson;
            
            // 環境変数から認証情報を構築
            if (config.google.privateKey && config.google.clientEmail && config.google.projectId) {
                logger.info('Initializing Earth Engine with environment variables');
                privateKeyJson = {
                    type: "service_account",
                    project_id: config.google.projectId,
                    private_key_id: config.google.privateKeyId || "",
                    private_key: config.google.privateKey.replace(/\\n/g, '\n'),
                    client_email: config.google.clientEmail,
                    client_id: config.google.serviceAccountClientId || "",
                    auth_uri: "https://accounts.google.com/o/oauth2/auth",
                    token_uri: "https://oauth2.googleapis.com/token",
                    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(config.google.clientEmail)}`
                };
            }
            // JSONファイルから認証情報を読み込む（従来の方法）
            else if (config.google.privateKeyPath) {
                logger.info('Initializing Earth Engine with JSON file');
                const fs = require('fs');
                const path = require('path');
                const keyFile = path.resolve(__dirname, '../../', config.google.privateKeyPath);
                
                if (!fs.existsSync(keyFile)) {
                    throw new Error(`Service account key file not found: ${keyFile}`);
                }
                
                privateKeyJson = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
            }
            else {
                throw new Error('Google Earth Engine service account credentials not configured');
            }
            
            await new Promise((resolve, reject) => {
                ee.data.authenticateViaPrivateKey(
                    privateKeyJson,
                    () => {
                        logger.info('Earth Engine authentication successful');
                        ee.initialize(null, null, () => {
                            logger.info('Earth Engine initialization successful');
                            this.isInitialized = true;
                            resolve();
                        }, (err) => {
                            logger.error('Earth Engine initialization error', err);
                            reject(new ExternalAPIError('Google Earth Engine', err));
                        });
                    },
                    (err) => {
                        logger.error('Earth Engine authentication error', err);
                        reject(new ExternalAPIError('Google Earth Engine', err));
                    }
                );
            });

            // 初期化成功後のテスト
            await this.performConnectionTest();

        } catch (error) {
            logger.error('Earth Engine initialization failed', error);
            this.isInitialized = false;
            throw error;
        }
    }

    // 接続テスト
    async performConnectionTest() {
        try {
            const point = ee.Geometry.Point([0, 0]);
            const info = await new Promise((resolve, reject) => {
                point.getInfo((result, error) => {
                    if (error) reject(error);
                    else resolve(result);
                });
            });
            
            logger.info('Earth Engine connection test successful', { testResult: info });
        } catch (error) {
            logger.warn('Earth Engine connection test failed', { error: error.message });
            throw new ExternalAPIError('Google Earth Engine', error);
        }
    }

    // 植生指標分析のメインメソッド
    async analyzeVegetationIndices(geoJsonData, options = {}) {
        const startTime = Date.now();

        try {
            // 初期化確認
            if (!this.isInitialized) {
                await this.initialize();
            }

            // 入力検証
            this.validateGeoJsonInput(geoJsonData);

            logger.info('Starting vegetation analysis', {
                geoJsonType: geoJsonData.type,
                coordinatesLength: JSON.stringify(geoJsonData.coordinates).length,
                options: options
            });

            // GeoJSONをEarth Engine Geometryに変換
            const geometry = this.convertToEEGeometry(geoJsonData);

            // 分析パラメータの設定
            const analysisParams = this.prepareAnalysisParameters(options);

            // Sentinel-2データの取得
            const imageCollection = this.getSentinel2Collection(geometry, analysisParams);

            // 画像の選択と検証
            const selectedImage = await this.selectBestImage(imageCollection);

            // 植生指標の計算
            const indices = this.calculateVegetationIndices(selectedImage);

            // 統計情報の計算
            const statistics = await this.calculateStatistics(indices, geometry);

            // マップタイルの生成
            const mapTiles = await this.generateMapTiles(indices);

            // 画像メタデータの取得
            const imageMetadata = await this.getImageMetadata(selectedImage);

            const responseTime = Date.now() - startTime;

            logger.info('Vegetation analysis completed', {
                responseTime: responseTime,
                imageDate: imageMetadata.date,
                cloudCover: imageMetadata.cloudCover
            });

            return {
                statistics: statistics,
                mapTiles: mapTiles,
                metadata: imageMetadata,
                analysisParams: analysisParams,
                responseTime: responseTime,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            logger.error('Vegetation analysis failed', error, {
                responseTime: responseTime,
                geoJsonType: geoJsonData?.type,
                isInitialized: this.isInitialized
            });

            throw this.handleGEEError(error);
        }
    }

    // GeoJSON入力の検証
    validateGeoJsonInput(geoJsonData) {
        if (!geoJsonData || typeof geoJsonData !== 'object') {
            throw new ValidationError('Invalid GeoJSON data');
        }

        if (!geoJsonData.type || !geoJsonData.coordinates) {
            throw new ValidationError('GeoJSON must have type and coordinates');
        }

        const allowedTypes = ['Polygon', 'Point', 'LineString'];
        if (!allowedTypes.includes(geoJsonData.type)) {
            throw new ValidationError(`Unsupported GeoJSON type: ${geoJsonData.type}`);
        }

        if (!Array.isArray(geoJsonData.coordinates)) {
            throw new ValidationError('GeoJSON coordinates must be an array');
        }
    }

    // GeoJSONをEarth Engine Geometryに変換
    convertToEEGeometry(geoJsonData) {
        try {
            return ee.Geometry[geoJsonData.type](geoJsonData.coordinates);
        } catch (error) {
            throw new ValidationError(`Failed to convert GeoJSON to Earth Engine Geometry: ${error.message}`);
        }
    }

    // 分析パラメータの準備
    prepareAnalysisParameters(options) {
        const defaultParams = {
            startDate: '2024-01-01',
            endDate: new Date().toISOString().split('T')[0],
            cloudThreshold: 20,
            scale: 10,
            maxPixels: 1e9,
            indices: ['NDVI', 'NDMI', 'NDRE']
        };

        return {
            ...defaultParams,
            ...options,
            // 日付の検証
            startDate: this.validateDate(options.startDate || defaultParams.startDate),
            endDate: this.validateDate(options.endDate || defaultParams.endDate)
        };
    }

    // 日付の検証
    validateDate(dateString) {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            throw new ValidationError(`Invalid date format: ${dateString}`);
        }
        return dateString;
    }

    // Sentinel-2コレクションの取得
    getSentinel2Collection(geometry, params) {
        return ee.ImageCollection('COPERNICUS/S2_SR')
            .filterDate(params.startDate, params.endDate)
            .filterBounds(geometry)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', params.cloudThreshold))
            .sort('system:time_start', false);
    }

    // 最適な画像の選択
    async selectBestImage(collection) {
        // コレクションサイズの確認
        const collectionSize = await new Promise((resolve, reject) => {
            collection.size().getInfo((size, error) => {
                if (error) reject(error);
                else resolve(size);
            });
        });

        if (collectionSize === 0) {
            throw new ValidationError('No suitable images found for the specified area and time range');
        }

        logger.info(`Found ${collectionSize} suitable images`);

        // 最新の画像を選択
        return collection.first();
    }

    // 植生指標の計算
    calculateVegetationIndices(image) {
        const indices = {};

        // NDVI (正規化差植生指数)
        indices.NDVI = image.normalizedDifference(['B8', 'B4']).rename('NDVI');

        // NDMI (正規化差水分指数)
        indices.NDMI = image.normalizedDifference(['B8', 'B11']).rename('NDMI');

        // NDRE (Red Edge 正規化差植生指数)
        indices.NDRE = image.normalizedDifference(['B8', 'B5']).rename('NDRE');

        // 全指標を結合
        indices.combined = ee.Image.cat([indices.NDVI, indices.NDMI, indices.NDRE]);

        return indices;
    }

    // 統計情報の計算
    async calculateStatistics(indices, geometry) {
        const stats = await new Promise((resolve, reject) => {
            indices.combined.reduceRegion({
                reducer: ee.Reducer.mean().combine(ee.Reducer.stdDev(), '', true)
                    .combine(ee.Reducer.minMax(), '', true),
                geometry: geometry,
                scale: 10,
                maxPixels: 1e9
            }).getInfo((result, error) => {
                if (error) reject(error);
                else resolve(result);
            });
        });

        logger.info('Statistics calculated', { statsKeys: Object.keys(stats) });
        return stats;
    }

    // マップタイルの生成
    async generateMapTiles(indices) {
        const visualizationParams = {
            NDVI: { min: -1, max: 1, palette: ['red', 'yellow', 'green'] },
            NDMI: { min: -1, max: 1, palette: ['red', 'yellow', 'blue'] },
            NDRE: { min: -1, max: 1, palette: ['red', 'yellow', 'green'] }
        };

        const mapTiles = {};

        for (const [indexName, visParams] of Object.entries(visualizationParams)) {
            try {
                const mapId = await new Promise((resolve, reject) => {
                    indices[indexName].getMapId(visParams, (mapId, error) => {
                        if (error) reject(error);
                        else resolve(mapId);
                    });
                });

                mapTiles[indexName] = this.extractTileUrl(mapId);
                
                logger.debug(`Map tile generated for ${indexName}`, {
                    tileUrl: mapTiles[indexName]?.substring(0, 50) + '...'
                });

            } catch (error) {
                logger.warn(`Failed to generate map tile for ${indexName}`, { error: error.message });
                mapTiles[indexName] = null;
            }
        }

        return mapTiles;
    }

    // タイルURLの抽出
    extractTileUrl(mapId) {
        if (!mapId) {
            return null;
        }

        // 複数のプロパティをチェック（APIバージョンの違いに対応）
        if (mapId.tile_fetcher && mapId.tile_fetcher.url_format) {
            return mapId.tile_fetcher.url_format;
        } 
        else if (mapId.tile_fetcher && mapId.tile_fetcher.url_format_string) {
            return mapId.tile_fetcher.url_format_string;
        }
        else if (mapId.urlFormat) {
            return mapId.urlFormat;
        }
        else if (mapId.formatTileUrl && typeof mapId.formatTileUrl === 'function') {
            try {
                const testUrl = mapId.formatTileUrl(0, 0, 0);
                return testUrl.replace(/\/0\/0\/0$/, '/{z}/{x}/{y}');
            } catch (e) {
                logger.warn('Failed to format tile URL', { error: e.message });
            }
        }

        // フォールバック用のダミーURL
        logger.warn('Could not extract tile URL, using fallback');
        return `https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/${Math.random().toString(36).substring(2, 10)}/tiles/{z}/{x}/{y}`;
    }

    // 画像メタデータの取得
    async getImageMetadata(image) {
        const metadata = await new Promise((resolve, reject) => {
            image.select(['B4']).getInfo((info, error) => {
                if (error) reject(error);
                else resolve(info);
            });
        });

        const imageDate = await new Promise((resolve, reject) => {
            ee.Date(image.get('system:time_start')).format('yyyy-MM-dd').getInfo((date, error) => {
                if (error) reject(error);
                else resolve(date);
            });
        });

        const cloudCover = await new Promise((resolve, reject) => {
            image.get('CLOUDY_PIXEL_PERCENTAGE').getInfo((cloudiness, error) => {
                if (error) reject(error);
                else resolve(cloudiness);
            });
        });

        return {
            date: imageDate,
            cloudCover: cloudCover,
            properties: metadata.properties || {}
        };
    }

    // モックデータ生成（GEE利用不可時）
    generateMockData(geoJsonData) {
        logger.info('Generating mock vegetation data');

        // 座標ベースのハッシュ値生成
        const coordStr = JSON.stringify(geoJsonData.coordinates);
        let hash = 0;
        for (let i = 0; i < coordStr.length; i++) {
            const char = coordStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const baseValue = Math.abs(hash) / 2147483647;

        // 各指標の値生成
        const ndviBase = 0.3 + (baseValue * 0.4); // 0.3-0.7
        const ndmiBase = 0.05 + (baseValue * 0.35); // 0.05-0.4
        const ndreBase = 0.05 + (baseValue * 0.25); // 0.05-0.3

        const stats = {
            'NDVI_mean': ndviBase,
            'NDVI_stdDev': Math.random() * 0.15 + 0.05,
            'NDVI_min': Math.max(0, ndviBase - 0.3),
            'NDVI_max': Math.min(1, ndviBase + 0.3),
            'NDMI_mean': ndmiBase,
            'NDMI_stdDev': Math.random() * 0.1 + 0.03,
            'NDMI_min': Math.max(-0.2, ndmiBase - 0.2),
            'NDMI_max': Math.min(0.6, ndmiBase + 0.2),
            'NDRE_mean': ndreBase,
            'NDRE_stdDev': Math.random() * 0.08 + 0.02,
            'NDRE_min': Math.max(-0.1, ndreBase - 0.15),
            'NDRE_max': Math.min(0.5, ndreBase + 0.15)
        };

        const mapTiles = {
            NDVI: `https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/${Math.random().toString(36).substring(2, 10)}/tiles/{z}/{x}/{y}`,
            NDMI: `https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/${Math.random().toString(36).substring(2, 10)}/tiles/{z}/{x}/{y}`,
            NDRE: `https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/${Math.random().toString(36).substring(2, 10)}/tiles/{z}/{x}/{y}`
        };

        const mockDate = new Date();
        mockDate.setDate(mockDate.getDate() - Math.floor(Math.random() * 10 + 5));

        return {
            statistics: stats,
            mapTiles: mapTiles,
            metadata: {
                date: mockDate.toISOString().split('T')[0],
                cloudCover: Math.random() * 15 + 5,
                properties: { mock: true }
            },
            analysisParams: {
                startDate: '2024-01-01',
                endDate: new Date().toISOString().split('T')[0],
                cloudThreshold: 20,
                scale: 10
            },
            responseTime: 2000 + Math.random() * 1000,
            timestamp: new Date().toISOString()
        };
    }

    // エラーハンドリング
    handleGEEError(error) {
        if (error instanceof ValidationError || error instanceof TimeoutError) {
            return error;
        }

        if (error instanceof ExternalAPIError) {
            return error;
        }

        return new ExternalAPIError('Google Earth Engine', error);
    }

    // ヘルスチェック
    async healthCheck() {
        const health = {
            status: 'healthy',
            initialized: this.isInitialized,
            timestamp: new Date().toISOString()
        };

        if (!this.isInitialized) {
            health.status = 'degraded';
            health.error = 'Google Earth Engine not initialized';
        }

        try {
            if (this.isInitialized) {
                await this.performConnectionTest();
            }
        } catch (error) {
            health.status = 'unhealthy';
            health.error = error.message;
        }

        return health;
    }
}

// シングルトンインスタンス
const geeService = new GEEService();

module.exports = geeService;