const Joi = require('joi');
const { body, validationResult } = require('express-validator');
const securityConfig = require('../config/security');
const logger = require('../utils/logger');

// カスタムエラークラス
class ValidationError extends Error {
    constructor(message, errors = []) {
        super(message);
        this.name = 'ValidationError';
        this.errors = errors;
        this.statusCode = 400;
    }
}

// プロンプトインジェクション検出
function detectPromptInjection(text) {
    const suspiciousPatterns = securityConfig.validation.prompt.forbiddenPatterns;
    const detectedPatterns = [];
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(text)) {
            detectedPatterns.push(pattern.source);
        }
    }
    
    return detectedPatterns;
}

// GeoJSON座標の検証
function validateCoordinates(coordinates, type) {
    const { maxBounds } = securityConfig.validation.geoJson;
    
    function validateCoordPair(coord) {
        if (!Array.isArray(coord) || coord.length !== 2) {
            return false;
        }
        
        const [lng, lat] = coord;
        
        if (typeof lng !== 'number' || typeof lat !== 'number') {
            return false;
        }
        
        if (lng < maxBounds.lng.min || lng > maxBounds.lng.max) {
            return false;
        }
        
        if (lat < maxBounds.lat.min || lat > maxBounds.lat.max) {
            return false;
        }
        
        return true;
    }
    
    function validateCoordArray(coords, depth = 0) {
        if (depth > securityConfig.validation.geoJson.maxNesting) {
            return false;
        }
        
        if (!Array.isArray(coords)) {
            return false;
        }
        
        for (const coord of coords) {
            if (Array.isArray(coord[0])) {
                // ネストした配列の場合
                if (!validateCoordArray(coord, depth + 1)) {
                    return false;
                }
            } else {
                // 座標ペアの場合
                if (!validateCoordPair(coord)) {
                    return false;
                }
            }
        }
        
        return true;
    }
    
    return validateCoordArray(coordinates);
}

// Joi スキーマ定義
const schemas = {
    // プロンプト検証スキーマ
    prompt: Joi.object({
        prompt: Joi.string()
            .min(securityConfig.validation.prompt.minLength)
            .max(securityConfig.validation.prompt.maxLength)
            .pattern(securityConfig.validation.prompt.allowedCharacters)
            .required()
            .custom((value, helpers) => {
                const injectionPatterns = detectPromptInjection(value);
                if (injectionPatterns.length > 0) {
                    logger.security('Prompt injection attempt detected', {
                        prompt: value.substring(0, 100) + '...',
                        patterns: injectionPatterns,
                        ip: helpers.state.ancestors[0]?.ip || 'unknown'
                    });
                    return helpers.error('prompt.injection');
                }
                return value;
            }, 'Prompt injection detection'),
        
        model: Joi.string()
            .valid('gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-thinking-exp-01-21', 'gemma-2-9b-it', 'gemma-2-27b-it')
            .optional(),
        
        context: Joi.object().optional()
    }).options({ abortEarly: false }),
    
    // GeoJSON検証スキーマ
    geoJson: Joi.object({
        aoiGeoJSON: Joi.object({
            type: Joi.string()
                .valid(...securityConfig.validation.geoJson.allowedTypes)
                .required(),
            
            coordinates: Joi.array()
                .items(Joi.array())
                .required()
                .custom((value, helpers) => {
                    const type = helpers.state.ancestors[0].type;
                    
                    if (!validateCoordinates(value, type)) {
                        return helpers.error('geojson.coordinates');
                    }
                    
                    // 座標数の制限チェック
                    const coordCount = JSON.stringify(value).split(',').length / 2;
                    if (coordCount > securityConfig.validation.geoJson.maxCoordinates) {
                        return helpers.error('geojson.tooManyCoordinates');
                    }
                    
                    return value;
                }, 'GeoJSON coordinates validation')
        }).required()
    }).options({ abortEarly: false }),
    
    // 分析リクエスト検証スキーマ
    analysisRequest: Joi.object({
        aoiGeoJSON: Joi.object({
            type: Joi.string()
                .valid('Polygon', 'Point')
                .required(),
            coordinates: Joi.array().required()
        }).required(),
        
        options: Joi.object({
            startDate: Joi.string().isoDate().optional(),
            endDate: Joi.string().isoDate().optional(),
            indices: Joi.array().items(Joi.string().valid('NDVI', 'NDMI', 'NDRE')).optional(),
            cloudThreshold: Joi.number().min(0).max(100).optional()
        }).optional()
    }).options({ abortEarly: false })
};

// Express-validator ミドルウェア
const expressValidators = {
    // プロンプト検証
    validatePrompt: [
        body('prompt')
            .isLength({ 
                min: securityConfig.validation.prompt.minLength, 
                max: securityConfig.validation.prompt.maxLength 
            })
            .withMessage(`プロンプトは${securityConfig.validation.prompt.minLength}-${securityConfig.validation.prompt.maxLength}文字である必要があります`)
            .matches(securityConfig.validation.prompt.allowedCharacters)
            .withMessage('許可されていない文字が含まれています')
            .custom((value) => {
                const injectionPatterns = detectPromptInjection(value);
                if (injectionPatterns.length > 0) {
                    throw new Error('セキュリティ上の理由により、このプロンプトは受け付けられません');
                }
                return true;
            }),
        
        body('model')
            .optional()
            .isIn(['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-thinking-exp-01-21', 'gemma-2-9b-it', 'gemma-2-27b-it'])
            .withMessage('無効なAIモデルです')
    ],
    
    // GeoJSON検証
    validateGeoJSON: [
        body('aoiGeoJSON.type')
            .isIn(securityConfig.validation.geoJson.allowedTypes)
            .withMessage('サポートされていないGeoJSONタイプです'),
        
        body('aoiGeoJSON.coordinates')
            .isArray()
            .withMessage('座標は配列である必要があります')
            .custom((value, { req }) => {
                const type = req.body.aoiGeoJSON?.type;
                if (!validateCoordinates(value, type)) {
                    throw new Error('無効な座標データです');
                }
                
                const coordCount = JSON.stringify(value).split(',').length / 2;
                if (coordCount > securityConfig.validation.geoJson.maxCoordinates) {
                    throw new Error(`座標数が上限（${securityConfig.validation.geoJson.maxCoordinates}）を超えています`);
                }
                
                return true;
            })
    ]
};

// Joi検証ミドルウェア生成
function createJoiValidator(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
            context: { ip: req.ip }
        });
        
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));
            
            logger.warn('Validation failed', {
                ip: req.ip,
                endpoint: req.originalUrl,
                errors: errors,
                userAgent: req.headers['user-agent']
            });
            
            return res.status(400).json({
                error: true,
                code: 'VALIDATION_FAILED',
                message: 'リクエストデータが無効です',
                errors: errors,
                timestamp: new Date().toISOString()
            });
        }
        
        // 検証済みデータで置き換え
        req.body = value;
        next();
    };
}

// Express-validator エラーハンドリング
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(error => ({
            field: error.path || error.param,
            message: error.msg,
            value: error.value
        }));
        
        logger.warn('Express validation failed', {
            ip: req.ip,
            endpoint: req.originalUrl,
            errors: formattedErrors,
            userAgent: req.headers['user-agent']
        });
        
        return res.status(400).json({
            error: true,
            code: 'VALIDATION_FAILED',
            message: 'リクエストデータが無効です',
            errors: formattedErrors,
            timestamp: new Date().toISOString()
        });
    }
    
    next();
}

// セキュリティ検証ミドルウェア
function securityValidation(req, res, next) {
    // リクエストサイズチェック
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSize = 1024 * 1024; // 1MB
    
    if (contentLength > maxSize) {
        logger.security('Request too large', {
            ip: req.ip,
            contentLength: contentLength,
            maxSize: maxSize,
            endpoint: req.originalUrl
        });
        
        return res.status(413).json({
            error: true,
            code: 'REQUEST_TOO_LARGE',
            message: 'リクエストサイズが大きすぎます',
            maxSize: maxSize
        });
    }
    
    // Content-Typeチェック
    if (req.method === 'POST' || req.method === 'PUT') {
        const contentType = req.headers['content-type'];
        if (!contentType || !contentType.includes('application/json')) {
            return res.status(415).json({
                error: true,
                code: 'UNSUPPORTED_MEDIA_TYPE',
                message: 'サポートされていないContent-Typeです'
            });
        }
    }
    
    next();
}

module.exports = {
    // Joi validators
    validatePrompt: createJoiValidator(schemas.prompt),
    validateGeoJSON: createJoiValidator(schemas.geoJson),
    validateAnalysisRequest: createJoiValidator(schemas.analysisRequest),
    
    // Express validators
    expressValidators,
    handleValidationErrors,
    
    // Security middleware
    securityValidation,
    
    // Utility functions
    detectPromptInjection,
    validateCoordinates,
    ValidationError,
    
    // Raw schemas for testing
    schemas
};