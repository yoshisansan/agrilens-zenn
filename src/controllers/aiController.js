const aiService = require('../services/aiService');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errors');
const { validateInput } = require('../utils/validators');

class AIController {
    // AI アドバイス生成
    generateAdvice = asyncHandler(async (req, res) => {
        const { prompt, model, context } = req.body;
        const startTime = Date.now();

        // リクエストログ
        logger.info('AI advice request received', {
            promptLength: prompt?.length || 0,
            model: model,
            hasContext: !!context,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        try {
            // 入力の追加検証
            const validation = validateInput(prompt, 'prompt');
            if (!validation.isValid) {
                return res.status(400).json({
                    error: true,
                    code: 'VALIDATION_FAILED',
                    message: '入力データが無効です',
                    errors: validation.errors,
                    timestamp: new Date().toISOString()
                });
            }

            // AI サービスを呼び出し
            const result = await aiService.generateAdvice(prompt, {
                model: model,
                context: context,
                maxTokens: 8192,
                temperature: 0.3
            });

            const responseTime = Date.now() - startTime;

            // 成功レスポンス
            res.json({
                success: true,
                result: result.result,
                metadata: {
                    model: result.model,
                    provider: result.provider,
                    responseTime: responseTime,
                    timestamp: result.timestamp
                }
            });

            // 成功ログ
            logger.info('AI advice generated successfully', {
                model: result.model,
                provider: result.provider,
                promptLength: prompt.length,
                responseLength: result.result?.length || 0,
                responseTime: responseTime,
                ip: req.ip
            });

        } catch (error) {
            const responseTime = Date.now() - startTime;

            // エラーログ
            logger.error('AI advice generation failed', error, {
                promptLength: prompt?.length || 0,
                model: model,
                responseTime: responseTime,
                ip: req.ip,
                errorType: error.constructor.name
            });

            // エラーレスポンスは errorHandler ミドルウェアが処理
            throw error;
        }
    });

    // Gemini API テスト（後方互換性用）
    testGeminiAPI = asyncHandler(async (req, res) => {
        logger.info('Gemini API test requested', {
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        try {
            const testResult = await aiService.testConnection();

            if (testResult.success) {
                res.json({
                    status: 'success',
                    message: 'AI API接続が正常です',
                    provider: testResult.provider,
                    model: testResult.model,
                    responseTime: testResult.responseTime,
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(503).json({
                    status: 'error',
                    message: 'AI API接続に失敗しました',
                    error: testResult.error,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            logger.error('AI API test failed', error);
            throw error;
        }
    });

    // AI サービスのヘルスチェック
    healthCheck = asyncHandler(async (req, res) => {
        try {
            const health = await aiService.healthCheck();
            
            const statusCode = health.status === 'healthy' ? 200 : 
                              health.status === 'degraded' ? 200 : 503;

            res.status(statusCode).json(health);

        } catch (error) {
            logger.error('AI service health check failed', error);
            
            res.status(503).json({
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    });

    // サーバー情報の取得（クライアント設定用）
    getServerInfo = asyncHandler(async (req, res) => {
        try {
            const health = await aiService.healthCheck();
            
            const serverInfo = {
                ai: {
                    available: health.status !== 'unhealthy',
                    providers: {
                        vertexAI: health.vertexAI?.available && health.vertexAI?.configured,
                        directAPI: health.directAPI?.configured
                    },
                    models: health.models?.available || [],
                    defaultModel: 'gemini-1.5-flash'
                },
                server: {
                    environment: process.env.NODE_ENV || 'development',
                    version: process.env.npm_package_version || '1.0.0',
                    timestamp: new Date().toISOString()
                }
            };

            res.json(serverInfo);

        } catch (error) {
            logger.error('Failed to get server info', error);
            
            // エラーでも基本情報は返す
            res.json({
                ai: {
                    available: false,
                    providers: {
                        vertexAI: false,
                        directAPI: false
                    },
                    models: [],
                    defaultModel: 'gemini-1.5-flash'
                },
                server: {
                    environment: process.env.NODE_ENV || 'development',
                    version: process.env.npm_package_version || '1.0.0',
                    timestamp: new Date().toISOString()
                },
                error: error.message
            });
        }
    });

    // モデル一覧の取得
    getAvailableModels = asyncHandler(async (req, res) => {
        try {
            const health = await aiService.healthCheck();
            
            const models = health.models?.available || [];
            const modelInfo = models.map(model => ({
                id: model,
                name: model,
                provider: model.startsWith('gemma') ? 'vertex' : 'both',
                description: this.getModelDescription(model),
                capabilities: this.getModelCapabilities(model)
            }));

            res.json({
                success: true,
                models: modelInfo,
                defaultModel: 'gemini-1.5-flash',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Failed to get available models', error);
            throw error;
        }
    });

    // モデルの説明取得
    getModelDescription(modelId) {
        const descriptions = {
            'gemini-1.5-flash': '高速応答、コスト効率重視',
            'gemini-1.5-pro': '高精度、複雑なタスク向け',
            'gemini-2.0-flash-thinking-exp-01-21': '最新の思考型モデル（実験的機能、推奨）',
            'gemma-2-9b-it': 'オープンソース、中規模モデル',
            'gemma-2-27b-it': 'オープンソース、大規模モデル'
        };
        
        return descriptions[modelId] || 'AI言語モデル';
    }

    // モデルの機能取得
    getModelCapabilities(modelId) {
        const capabilities = {
            'gemini-1.5-flash': ['text', 'fast-response'],
            'gemini-1.5-pro': ['text', 'high-quality', 'complex-reasoning'],
            'gemini-2.0-flash-thinking-exp-01-21': ['text', 'thinking', 'experimental'],
            'gemma-2-9b-it': ['text', 'open-source', 'instruction-tuned'],
            'gemma-2-27b-it': ['text', 'open-source', 'instruction-tuned', 'large-scale']
        };
        
        return capabilities[modelId] || ['text'];
    }

    // 使用統計の取得（将来の機能）
    getUsageStats = asyncHandler(async (req, res) => {
        // 現在はモック実装
        const stats = {
            totalRequests: 0,
            successfulRequests: 0,
            averageResponseTime: 0,
            modelUsage: {},
            errorRate: 0,
            period: '24h',
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            stats: stats,
            message: '統計機能は今後実装予定です'
        });
    });
}

module.exports = new AIController();