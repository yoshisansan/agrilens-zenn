// 植生指標の計算と処理を行うモジュール

/**
 * NDVI (正規化差植生指数) の計算関数
 * 植物の光合成活性や植生の活力を示す
 * NDVI = (NIR - RED) / (NIR + RED)
 * @param {Object} image - Sentinel-2画像オブジェクト
 * @returns {Object} - NDVI画像レイヤー
 */
function calculateNDVI(image) {
    return image.normalizedDifference(['B8', 'B4']).rename('NDVI');
}

/**
 * NDMI (正規化差水分指数) の計算関数
 * 植物の水分ストレスや含水量を示す
 * NDMI = (NIR - SWIR1) / (NIR + SWIR1)
 * @param {Object} image - Sentinel-2画像オブジェクト
 * @returns {Object} - NDMI画像レイヤー
 */
function calculateNDMI(image) {
    return image.normalizedDifference(['B8', 'B11']).rename('NDMI');
}

/**
 * NDRE (Red Edge 正規化差植生指数) の計算関数
 * 葉の窒素含有量や栄養状態を示す
 * NDRE = (NIR - RedEdge) / (NIR + RedEdge)
 * @param {Object} image - Sentinel-2画像オブジェクト
 * @returns {Object} - NDRE画像レイヤー
 */
function calculateNDRE(image) {
    return image.normalizedDifference(['B8', 'B5']).rename('NDRE');
}

/**
 * 複数の植生指標を計算し、一つの複合画像として返す
 * @param {Object} image - Sentinel-2画像オブジェクト
 * @returns {Object} - 複数の植生指標を含む複合画像
 */
function calculateAllIndices(image) {
    const ndvi = calculateNDVI(image);
    const ndmi = calculateNDMI(image);
    const ndre = calculateNDRE(image);
    
    return ee.Image.cat([ndvi, ndmi, ndre]);
}

/**
 * 植生指標の統計情報を計算
 * @param {Object} indices - 複数の植生指標を含む画像
 * @param {Object} geometry - 分析対象の領域（ポリゴン）
 * @param {number} scale - 分析スケール（解像度）
 * @returns {Promise} - 統計情報を含むオブジェクトのPromise
 */
function calculateIndicesStats(indices, geometry, scale) {
    return indices.reduceRegion({
        reducer: ee.Reducer.mean().combine(ee.Reducer.stdDev(), '', true)
            .combine(ee.Reducer.minMax(), '', true),
        geometry: geometry,
        scale: scale || 10,
        maxPixels: 1e9
    }).getInfo();
}

/**
 * 各植生指標のヘルスステータスを評価
 * @param {Object} stats - 植生指標の統計情報
 * @param {string} cropType - 作物タイプ（任意）
 * @returns {Object} - 各指標のヘルスステータス
 */
function evaluateIndicesHealth(stats, cropType) {
    // 作物タイプごとの閾値設定
    const thresholds = {
        'デフォルト': {
            ndvi_good: 0.6, ndvi_moderate: 0.4,
            ndmi_good: 0.3, ndmi_moderate: 0.1,
            ndre_good: 0.2, ndre_moderate: 0.1
        },
        '稲': {
            ndvi_good: 0.7, ndvi_moderate: 0.5,
            ndmi_good: 0.4, ndmi_moderate: 0.2,
            ndre_good: 0.25, ndre_moderate: 0.15
        },
        'トマト': {
            ndvi_good: 0.6, ndvi_moderate: 0.4,
            ndmi_good: 0.3, ndmi_moderate: 0.1,
            ndre_good: 0.2, ndre_moderate: 0.1
        },
        'じゃがいも': {
            ndvi_good: 0.65, ndvi_moderate: 0.45,
            ndmi_good: 0.35, ndmi_moderate: 0.15,
            ndre_good: 0.22, ndre_moderate: 0.12
        }
        // 他の作物も必要に応じて追加
    };

    // 適切な閾値セットを選択
    const threshold = thresholds[cropType] || thresholds['デフォルト'];
    
    // 各指標の評価
    const ndviMean = stats['NDVI_mean'] || 0;
    const ndmiMean = stats['NDMI_mean'] || 0;
    const ndreMean = stats['NDRE_mean'] || 0;
    
    return {
        vegetation: {
            value: ndviMean,
            status: ndviMean > threshold.ndvi_good ? 'good' : 
                    (ndviMean > threshold.ndvi_moderate ? 'moderate' : 'poor'),
            description: getDescriptionForNDVI(ndviMean, threshold)
        },
        moisture: {
            value: ndmiMean,
            status: ndmiMean > threshold.ndmi_good ? 'good' : 
                    (ndmiMean > threshold.ndmi_moderate ? 'moderate' : 'poor'),
            description: getDescriptionForNDMI(ndmiMean, threshold)
        },
        nutrition: {
            value: ndreMean,
            status: ndreMean > threshold.ndre_good ? 'good' : 
                    (ndreMean > threshold.ndre_moderate ? 'moderate' : 'poor'),
            description: getDescriptionForNDRE(ndreMean, threshold)
        }
    };
}

/**
 * NDVI値に基づく説明文を生成
 */
function getDescriptionForNDVI(value, threshold) {
    if (value > threshold.ndvi_good) {
        return '植生の状態は良好です。光合成活性が高く、健全な生育が見られます。';
    } else if (value > threshold.ndvi_moderate) {
        return '植生の状態は普通です。生育はしていますが、最適な状態ではありません。';
    } else {
        return '植生の状態は良くありません。生育不良や植被率の低下が見られます。';
    }
}

/**
 * NDMI値に基づく説明文を生成
 */
function getDescriptionForNDMI(value, threshold) {
    if (value > threshold.ndmi_good) {
        return '水分状態は良好です。十分な水分が確保されています。';
    } else if (value > threshold.ndmi_moderate) {
        return '水分状態は普通です。軽度の水分ストレスの可能性があります。';
    } else {
        return '水分状態は良くありません。水分ストレスの兆候があります。灌漑の検討をおすすめします。';
    }
}

/**
 * NDRE値に基づく説明文を生成
 */
function getDescriptionForNDRE(value, threshold) {
    if (value > threshold.ndre_good) {
        return '栄養状態は良好です。十分な窒素含有量があります。';
    } else if (value > threshold.ndre_moderate) {
        return '栄養状態は普通です。最適な窒素レベルではない可能性があります。';
    } else {
        return '栄養状態は良くありません。窒素不足の兆候があります。施肥の検討をおすすめします。';
    }
}

/**
 * 総合的な健康診断と推奨アクションを生成
 * @param {Object} evaluation - 各指標の評価結果
 * @returns {Object} - 総合評価と推奨アクション
 */
function generateOverallDiagnosis(evaluation) {
    const issues = [];
    const actions = [];
    
    // 問題点の特定
    if (evaluation.vegetation.status === 'poor') {
        issues.push('全体的な植生の活力低下');
    }
    
    if (evaluation.moisture.status === 'poor') {
        issues.push('水分ストレス');
        actions.push('灌漑の検討');
    } else if (evaluation.moisture.status === 'moderate' && evaluation.vegetation.status !== 'good') {
        actions.push('水分管理の見直し');
    }
    
    if (evaluation.nutrition.status === 'poor') {
        issues.push('栄養不足（特に窒素）');
        actions.push('施肥の検討');
    } else if (evaluation.nutrition.status === 'moderate' && evaluation.vegetation.status !== 'good') {
        actions.push('栄養管理の見直し');
    }
    
    // 総合評価
    let overallStatus;
    if (evaluation.vegetation.status === 'good' && 
        evaluation.moisture.status === 'good' && 
        evaluation.nutrition.status === 'good') {
        overallStatus = 'excellent';
    } else if (evaluation.vegetation.status === 'poor' || 
              (evaluation.moisture.status === 'poor' && evaluation.nutrition.status === 'poor')) {
        overallStatus = 'poor';
    } else {
        overallStatus = 'moderate';
    }
    
    return {
        status: overallStatus,
        issues: issues,
        actions: actions
    };
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateNDVI,
        calculateNDMI,
        calculateNDRE,
        calculateAllIndices,
        calculateIndicesStats,
        evaluateIndicesHealth,
        generateOverallDiagnosis
    };
} 