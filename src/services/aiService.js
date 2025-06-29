const config = require('../config');
const logger = require('../utils/logger');
const { ExternalAPIError, TimeoutError, ValidationError } = require('../utils/errors');

// Vertex AI用のインポート
let VertexAI;
try {
    VertexAI = require('@google-cloud/vertexai');
} catch (error) {
    logger.warn('Vertex AI SDK not available', { error: error.message });
}

class AIService {
    constructor() {
        this.vertexAI = null;
        this.isInitialized = false;
        this.initializeVertexAI();
    }

    // Vertex AI の初期化
    initializeVertexAI() {
        if (!VertexAI || !config.google.projectId) {
            logger.info('Vertex AI not configured, using direct API fallback');
            return;
        }

        try {
            const serviceAccountKey = {
                type: 'service_account',
                project_id: config.google.projectId,
                private_key_id: config.google.privateKeyId,
                private_key: config.google.privateKey?.replace(/\\n/g, '\n'),
                client_email: config.google.clientEmail,
                auth_uri: 'https://accounts.google.com/o/oauth2/auth',
                token_uri: 'https://oauth2.googleapis.com/token',
                auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
                client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(config.google.clientEmail)}`
            };

            this.vertexAI = new VertexAI.VertexAI({
                project: config.google.projectId,
                location: config.google.cloudRegion,
                googleAuthOptions: {
                    credentials: serviceAccountKey
                }
            });

            this.isInitialized = true;
            logger.info('Vertex AI initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Vertex AI', error);
            this.isInitialized = false;
        }
    }

    // AIアドバイス生成のメインメソッド
    async generateAdvice(prompt, options = {}) {
        const startTime = Date.now();
        
        try {
            // 入力検証
            this.validatePrompt(prompt);
            
            // モデル選択
            const model = options.model || config.ai.model;
            
            // プロバイダー判定
            const shouldUseVertex = config.ai.provider === 'vertex' && this.isInitialized;
            
            logger.info('AI advice generation started', {
                provider: shouldUseVertex ? 'vertex' : 'direct',
                model: model,
                promptLength: prompt.length
            });

            let result;
            if (shouldUseVertex) {
                result = await this.generateWithVertex(prompt, model, options);
            } else {
                result = await this.generateWithDirect(prompt, model, options);
            }

            const responseTime = Date.now() - startTime;
            
            logger.info('AI advice generation completed', {
                provider: shouldUseVertex ? 'vertex' : 'direct',
                model: model,
                responseTime: responseTime,
                responseLength: result?.length || 0
            });

            return {
                result: result,
                model: model,
                provider: shouldUseVertex ? 'vertex' : 'direct',
                responseTime: responseTime,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            logger.error('AI advice generation failed', error, {
                promptLength: prompt.length,
                responseTime: responseTime,
                model: options.model || config.ai.model
            });

            throw this.handleAIError(error);
        }
    }

    // Vertex AI経由での生成
    async generateWithVertex(prompt, modelName, options = {}) {
        if (!this.vertexAI) {
            throw new ExternalAPIError('Vertex AI', new Error('Vertex AI not initialized'));
        }

        try {
            if (modelName.startsWith('gemma')) {
                return await this.generateWithGemma(prompt, modelName, options);
            } else {
                return await this.generateWithGemini(prompt, modelName, options);
            }
        } catch (error) {
            logger.error('Vertex AI generation failed', error, {
                model: modelName,
                promptLength: prompt.length
            });
            throw new ExternalAPIError('Vertex AI', error);
        }
    }

    // Gemini (Vertex AI) での生成
    async generateWithGemini(prompt, modelName, options = {}) {
        const model = this.vertexAI.preview.getGenerativeModel({
            model: modelName,
            generationConfig: {
                maxOutputTokens: options.maxTokens || 8192,
                temperature: options.temperature || 0.3,
                topP: options.topP || 0.8,
                topK: options.topK || 40,
            },
        });

        // プロンプトがJSON形式を要求しているかチェック
        const isJsonRequest = this.isJsonRequest(prompt);
        
        const request = {
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        };

        if (isJsonRequest) {
            request.generationConfig = {
                ...request.generationConfig,
                responseMimeType: "application/json"
            };
        }

        const result = await this.executeWithTimeout(
            () => model.generateContent(request),
            config.ai.timeout,
            'Gemini generation'
        );

        const response = await result.response;
        return response.candidates[0].content.parts[0].text;
    }

    // Gemma (Vertex AI) での生成
    async generateWithGemma(prompt, modelName, options = {}) {
        const model = this.vertexAI.preview.getGenerativeModel({
            model: modelName,
            generationConfig: {
                maxOutputTokens: options.maxTokens || 8192,
                temperature: options.temperature || 0.3,
                topP: options.topP || 0.8,
                topK: options.topK || 40,
            },
        });

        const result = await this.executeWithTimeout(
            () => model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
            }),
            config.ai.timeout,
            'Gemma generation'
        );

        const response = await result.response;
        return response.candidates[0].content.parts[0].text;
    }

    // 直接API経由での生成
    async generateWithDirect(prompt, modelName, options = {}) {
        if (!config.ai.geminiApiKey) {
            throw new ExternalAPIError('Gemini API', new Error('API key not configured'));
        }

        // Gemmaモデルは直接APIではサポートされていない
        if (modelName.startsWith('gemma')) {
            throw new ValidationError('直接APIではGemmaモデルはサポートされていません。Vertex AIを使用してください。');
        }

        const fetch = await import('node-fetch').then(module => module.default);
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
        const isJsonRequest = this.isJsonRequest(prompt);
        
        const requestBody = {
            contents: [{ 
                role: 'user', 
                parts: [{ text: prompt }] 
            }],
            generationConfig: {
                temperature: options.temperature || 0.3,
                topP: options.topP || 0.8,
                topK: options.topK || 40,
                maxOutputTokens: options.maxTokens || 8192
            }
        };

        if (isJsonRequest) {
            requestBody.generationConfig.responseMimeType = "application/json";
        }

        const response = await this.executeWithTimeout(
            () => fetch(`${apiUrl}?key=${config.ai.geminiApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }),
            config.ai.timeout,
            'Direct API call'
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && 
            data.candidates[0].content && data.candidates[0].content.parts && 
            data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('Unexpected response format from Gemini API');
        }
    }

    // プロンプト検証
    validatePrompt(prompt) {
        if (!prompt || typeof prompt !== 'string') {
            throw new ValidationError('プロンプトは文字列である必要があります');
        }

        if (prompt.length < 1) {
            throw new ValidationError('プロンプトが空です');
        }

        if (prompt.length > 5000) {
            throw new ValidationError('プロンプトが長すぎます（最大5000文字）');
        }
    }

    // JSON要求の判定
    isJsonRequest(prompt) {
        return prompt.includes('JSON') || 
               prompt.includes('JSONスキーマ') || 
               prompt.includes('"type": "object"');
    }

    // タイムアウト付き実行
    async executeWithTimeout(operation, timeout, operationName) {
        return new Promise(async (resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new TimeoutError(operationName, timeout));
            }, timeout);

            try {
                const result = await operation();
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    // エラーハンドリング
    handleAIError(error) {
        if (error instanceof TimeoutError || error instanceof ValidationError) {
            return error;
        }

        if (error instanceof ExternalAPIError) {
            return error;
        }

        // 一般的なエラーの場合
        return new ExternalAPIError('AI Service', error);
    }

    // ヘルスチェック
    async healthCheck() {
        const health = {
            status: 'healthy',
            vertexAI: {
                available: !!VertexAI,
                initialized: this.isInitialized,
                configured: !!(config.google.projectId && config.google.privateKey && config.google.clientEmail)
            },
            directAPI: {
                configured: !!config.ai.geminiApiKey
            },
            models: {
                available: []
            },
            timestamp: new Date().toISOString()
        };

        // 利用可能なモデルの確認
        if (this.isInitialized) {
            health.models.available.push('gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-thinking-exp-01-21', 'gemma-2-9b-it', 'gemma-2-27b-it');
        } else if (config.ai.geminiApiKey) {
            health.models.available.push('gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-thinking-exp-01-21');
        }

        if (health.models.available.length === 0) {
            health.status = 'degraded';
        }

        return health;
    }

    // 簡単な接続テスト
    async testConnection() {
        try {
            const testPrompt = 'Hello, respond with "OK" only.';
            const result = await this.generateAdvice(testPrompt, { maxTokens: 10 });
            
            return {
                success: true,
                provider: result.provider,
                model: result.model,
                responseTime: result.responseTime
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                provider: null
            };
        }
    }
}

// シングルトンインスタンス
const aiService = new AIService();

module.exports = aiService;