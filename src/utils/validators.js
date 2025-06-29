const securityConfig = require('../config/security');
const logger = require('./logger');

// プロンプトインジェクション検出パターン
const PROMPT_INJECTION_PATTERNS = [
    // 指示の無視や上書き
    /ignore\s+(previous\s+|all\s+)?(instructions?|commands?|rules?)/gi,
    /forget\s+(everything|all|previous)/gi,
    /disregard\s+(previous\s+|all\s+)?(instructions?|commands?)/gi,
    
    // システムプロンプトの操作
    /system\s*:\s*/gi,
    /assistant\s*:\s*/gi,
    /human\s*:\s*/gi,
    /user\s*:\s*/gi,
    
    // ロール変更の試み
    /you\s+are\s+now/gi,
    /act\s+as/gi,
    /pretend\s+to\s+be/gi,
    /roleplay\s+as/gi,
    
    // スクリプト系のインジェクション
    /<script[^>]*>/gi,
    /javascript\s*:/gi,
    /eval\s*\(/gi,
    /function\s*\(/gi,
    /document\./gi,
    /window\./gi,
    
    // SQL インジェクション系
    /union\s+select/gi,
    /drop\s+table/gi,
    /delete\s+from/gi,
    /insert\s+into/gi,
    
    // コマンドインジェクション
    /\|\s*(ls|cat|pwd|whoami|id|ps|netstat)/gi,
    /;\s*(ls|cat|pwd|whoami|id|ps|netstat)/gi,
    /&&\s*(ls|cat|pwd|whoami|id|ps|netstat)/gi,
    
    // 機密情報の取得試行
    /show\s+me\s+(your\s+)?(system\s+|internal\s+)?prompt/gi,
    /what\s+(is\s+)?(your\s+)?(system\s+|internal\s+)?prompt/gi,
    /reveal\s+(your\s+)?instructions/gi,
    
    // エンコード系の回避試行
    /&#x[0-9a-f]+;/gi,
    /%[0-9a-f]{2}/gi,
    /\\u[0-9a-f]{4}/gi,
    
    // 繰り返しパターン（DoS試行）
    /(.{1,10})\1{50,}/g, // 同じパターンが50回以上繰り返される
    
    // 異常に長い単語（バッファオーバーフロー試行）
    /\S{500,}/g
];

// 悪意のあるファイルパス検出
const MALICIOUS_PATH_PATTERNS = [
    /\.\.\//g,     // ディレクトリトラバーサル
    /\.\.\\/g,     // Windowsスタイルのディレクトリトラバーサル
    /\/etc\/passwd/gi,
    /\/proc\/self\/environ/gi,
    /\.\.%2f/gi,   // URLエンコードされたディレクトリトラバーサル
    /%2e%2e%2f/gi  // 完全URLエンコード
];

// プロンプトインジェクション検出
function detectPromptInjection(text) {
    if (!text || typeof text !== 'string') {
        return { isDetected: false, patterns: [], score: 0 };
    }
    
    const detectedPatterns = [];
    let riskScore = 0;
    
    // 各パターンをチェック
    for (const pattern of PROMPT_INJECTION_PATTERNS) {
        const matches = text.match(pattern);
        if (matches) {
            detectedPatterns.push({
                pattern: pattern.source,
                matches: matches,
                count: matches.length
            });
            
            // リスクスコアの計算
            if (pattern.source.includes('ignore|forget|disregard')) {
                riskScore += 10; // 高リスク
            } else if (pattern.source.includes('system|assistant|human')) {
                riskScore += 8;  // 中高リスク
            } else if (pattern.source.includes('script|eval|function')) {
                riskScore += 6;  // 中リスク
            } else {
                riskScore += 3;  // 低リスク
            }
            
            riskScore += matches.length; // マッチ数に応じて加算
        }
    }
    
    const isDetected = detectedPatterns.length > 0 || riskScore > 5;
    
    if (isDetected) {
        logger.security('Prompt injection detected', {
            text: text.substring(0, 200) + '...',
            patterns: detectedPatterns.length,
            riskScore: riskScore,
            detectedPatterns: detectedPatterns.map(p => p.pattern)
        });
    }
    
    return {
        isDetected: isDetected,
        patterns: detectedPatterns,
        score: riskScore,
        severity: getSeverityLevel(riskScore)
    };
}

// 悪意のあるパス検出
function detectMaliciousPath(path) {
    if (!path || typeof path !== 'string') {
        return { isDetected: false, patterns: [] };
    }
    
    const detectedPatterns = [];
    
    for (const pattern of MALICIOUS_PATH_PATTERNS) {
        const matches = path.match(pattern);
        if (matches) {
            detectedPatterns.push({
                pattern: pattern.source,
                matches: matches
            });
        }
    }
    
    const isDetected = detectedPatterns.length > 0;
    
    if (isDetected) {
        logger.security('Malicious path detected', {
            path: path,
            patterns: detectedPatterns.map(p => p.pattern)
        });
    }
    
    return {
        isDetected: isDetected,
        patterns: detectedPatterns
    };
}

// GeoJSON座標の詳細検証
function validateGeoJSONCoordinates(geoJson) {
    try {
        if (!geoJson || typeof geoJson !== 'object') {
            return { isValid: false, error: 'GeoJSONオブジェクトが無効です' };
        }
        
        const { type, coordinates } = geoJson;
        const config = securityConfig.validation.geoJson;
        
        // タイプの検証
        if (!config.allowedTypes.includes(type)) {
            return { isValid: false, error: `サポートされていないGeoJSONタイプ: ${type}` };
        }
        
        // 座標の基本検証
        if (!Array.isArray(coordinates)) {
            return { isValid: false, error: '座標は配列である必要があります' };
        }
        
        // 座標数の制限チェック
        const coordCount = countCoordinates(coordinates);
        if (coordCount > config.maxCoordinates) {
            return { 
                isValid: false, 
                error: `座標数が上限（${config.maxCoordinates}）を超えています: ${coordCount}` 
            };
        }
        
        // ネスト階層の制限チェック
        const maxDepth = getMaxNestingDepth(coordinates);
        if (maxDepth > config.maxNesting) {
            return { 
                isValid: false, 
                error: `ネスト階層が上限（${config.maxNesting}）を超えています: ${maxDepth}` 
            };
        }
        
        // 座標範囲の検証
        const boundsCheck = validateCoordinateBounds(coordinates, config.maxBounds);
        if (!boundsCheck.isValid) {
            return boundsCheck;
        }
        
        // ジオメトリの妥当性チェック
        const geometryCheck = validateGeometry(type, coordinates);
        if (!geometryCheck.isValid) {
            return geometryCheck;
        }
        
        return { isValid: true };
    } catch (error) {
        logger.error('GeoJSON validation error', error);
        return { isValid: false, error: 'GeoJSON検証中にエラーが発生しました' };
    }
}

// 座標数をカウント
function countCoordinates(coordinates, count = 0) {
    if (!Array.isArray(coordinates)) {
        return count;
    }
    
    for (const coord of coordinates) {
        if (Array.isArray(coord)) {
            if (typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                count++; // 座標ペアをカウント
            } else {
                count = countCoordinates(coord, count); // 再帰的にカウント
            }
        }
    }
    
    return count;
}

// ネスト階層の最大深度を取得
function getMaxNestingDepth(arr, depth = 0) {
    if (!Array.isArray(arr)) {
        return depth;
    }
    
    let maxDepth = depth;
    for (const item of arr) {
        if (Array.isArray(item)) {
            const itemDepth = getMaxNestingDepth(item, depth + 1);
            maxDepth = Math.max(maxDepth, itemDepth);
        }
    }
    
    return maxDepth;
}

// 座標の範囲検証
function validateCoordinateBounds(coordinates, bounds) {
    function checkBounds(coords) {
        if (!Array.isArray(coords)) {
            return true;
        }
        
        for (const coord of coords) {
            if (Array.isArray(coord)) {
                if (typeof coord[0] === 'number' && typeof coord[1] === 'number') {
                    const [lng, lat] = coord;
                    
                    if (lng < bounds.lng.min || lng > bounds.lng.max) {
                        return { isValid: false, error: `経度が範囲外です: ${lng}` };
                    }
                    
                    if (lat < bounds.lat.min || lat > bounds.lat.max) {
                        return { isValid: false, error: `緯度が範囲外です: ${lat}` };
                    }
                } else {
                    const result = checkBounds(coord);
                    if (result !== true) {
                        return result;
                    }
                }
            }
        }
        
        return true;
    }
    
    const result = checkBounds(coordinates);
    return result === true ? { isValid: true } : result;
}

// ジオメトリの妥当性検証
function validateGeometry(type, coordinates) {
    switch (type) {
        case 'Point':
            if (!Array.isArray(coordinates) || coordinates.length !== 2) {
                return { isValid: false, error: 'Pointの座標は[経度, 緯度]の形式である必要があります' };
            }
            break;
            
        case 'LineString':
            if (!Array.isArray(coordinates) || coordinates.length < 2) {
                return { isValid: false, error: 'LineStringは最低2つの座標が必要です' };
            }
            break;
            
        case 'Polygon':
            if (!Array.isArray(coordinates) || coordinates.length === 0) {
                return { isValid: false, error: 'Polygonには最低1つのリングが必要です' };
            }
            
            for (const ring of coordinates) {
                if (!Array.isArray(ring) || ring.length < 4) {
                    return { isValid: false, error: 'Polygonのリングは最低4つの座標が必要です' };
                }
                
                // 閉じた形状の確認
                const first = ring[0];
                const last = ring[ring.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    return { isValid: false, error: 'Polygonのリングは閉じた形状である必要があります' };
                }
            }
            break;
    }
    
    return { isValid: true };
}

// データサニタイゼーション
function sanitizeString(str, options = {}) {
    if (!str || typeof str !== 'string') {
        return str;
    }
    
    let sanitized = str;
    
    // HTMLタグの除去（オプション）
    if (options.removeHtml !== false) {
        sanitized = sanitized.replace(/<[^>]*>/g, '');
    }
    
    // スクリプト系の除去
    if (options.removeScript !== false) {
        sanitized = sanitized.replace(/javascript\s*:/gi, '');
        sanitized = sanitized.replace(/on\w+\s*=/gi, '');
    }
    
    // 制御文字の除去
    if (options.removeControlChars !== false) {
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    }
    
    // 長さの制限
    if (options.maxLength && sanitized.length > options.maxLength) {
        sanitized = sanitized.substring(0, options.maxLength);
    }
    
    return sanitized;
}

// リスクスコアに基づく重要度レベルの判定
function getSeverityLevel(score) {
    if (score >= 20) return 'CRITICAL';
    if (score >= 15) return 'HIGH';
    if (score >= 10) return 'MEDIUM';
    if (score >= 5) return 'LOW';
    return 'MINIMAL';
}

// 入力データの包括的検証
function validateInput(data, type = 'general') {
    const results = {
        isValid: true,
        errors: [],
        warnings: [],
        sanitized: data
    };
    
    if (typeof data === 'string') {
        // プロンプトインジェクション検出
        const injectionCheck = detectPromptInjection(data);
        if (injectionCheck.isDetected) {
            results.isValid = false;
            results.errors.push(`セキュリティリスクが検出されました: スコア ${injectionCheck.score}`);
        }
        
        // 悪意のあるパス検出
        const pathCheck = detectMaliciousPath(data);
        if (pathCheck.isDetected) {
            results.isValid = false;
            results.errors.push('悪意のあるパスパターンが検出されました');
        }
        
        // データのサニタイゼーション
        results.sanitized = sanitizeString(data);
    }
    
    return results;
}

module.exports = {
    detectPromptInjection,
    detectMaliciousPath,
    validateGeoJSONCoordinates,
    sanitizeString,
    validateInput,
    getSeverityLevel,
    
    // 内部関数（テスト用）
    countCoordinates,
    getMaxNestingDepth,
    validateCoordinateBounds,
    validateGeometry
};