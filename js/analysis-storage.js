/**
 * 分析結果のローカルストレージ管理機能
 * 分析結果を蓄積保存し、履歴管理を行う
 */

// ローカルストレージのキー定数
const STORAGE_KEYS = {
    ANALYSIS_RESULTS: 'agrilens_analysis_results',
    ANALYSIS_HISTORY: 'agrilens_analysis_history',
    ANALYSIS_SETTINGS: 'agrilens_analysis_settings'
};

// 分析結果の最大保存件数
const MAX_STORED_RESULTS = 100;

/**
 * 分析結果をローカルストレージに保存する
 * @param {Object} analysisData - 分析データ
 * @param {Object} fieldData - 圃場データ
 * @param {Object} aiAdvice - AIアドバイス（オプション）
 */
function saveAnalysisResult(analysisData, fieldData, aiAdvice = null) {
    try {
        const timestamp = Date.now();
        const analysisId = generateAnalysisId(timestamp, fieldData);
        
        // 保存する分析結果オブジェクト
        const analysisResult = {
            id: analysisId,
            timestamp: timestamp,
            date: new Date(timestamp).toISOString(),
            dateFormatted: new Date(timestamp).toLocaleString('ja-JP'),
            
            // 圃場情報
            field: {
                id: fieldData?.id || window.currentFieldId || null,
                name: fieldData?.name || '選択圃場',
                location: {
                    latitude: fieldData?.latitude || null,
                    longitude: fieldData?.longitude || null
                },
                crop: fieldData?.crop || '不明',
                region: fieldData?.region || '日本',
                area: fieldData?.area || '不明'
            },
            
            // 分析データ
            analysis: {
                dateRange: analysisData?.dateRange || null,
                stats: {
                    ndvi: analysisData?.stats?.ndvi || { mean: '-', min: '-', max: '-', stdDev: '-' },
                    ndmi: analysisData?.stats?.ndmi || { mean: '-', min: '-', max: '-', stdDev: '-' },
                    ndre: analysisData?.stats?.ndre || { mean: '-', min: '-', max: '-', stdDev: '-' }
                },
                tileUrls: {
                    ndvi: analysisData?.ndviTileUrlTemplate || null,
                    ndmi: analysisData?.ndmiTileUrlTemplate || null,
                    ndre: analysisData?.ndreTileUrlTemplate || null
                }
            },
            
            // 健康状態評価
            evaluation: evaluateFieldHealthForStorage(analysisData?.stats),
            
            // AIアドバイス
            aiAdvice: aiAdvice || null,
            
            // メタデータ
            metadata: {
                version: '1.0',
                source: 'agrilens_poc',
                userAgent: navigator.userAgent,
                url: window.location.href
            }
        };
        
        // 既存の結果を取得
        const existingResults = getStoredAnalysisResults();
        
        // 新しい結果を先頭に追加
        existingResults.unshift(analysisResult);
        
        // 最大件数を超えた場合は古いものを削除
        if (existingResults.length > MAX_STORED_RESULTS) {
            existingResults.splice(MAX_STORED_RESULTS);
        }
        
        // ローカルストレージに保存
        localStorage.setItem(STORAGE_KEYS.ANALYSIS_RESULTS, JSON.stringify(existingResults));
        
        // 履歴にも記録
        updateAnalysisHistory(analysisResult);
        
        console.log('分析結果をローカルストレージに保存しました:', analysisId);
        
        // 保存成功の通知
        if (typeof showToast === 'function') {
            showToast('保存完了', '分析結果をローカルストレージに保存しました');
        }
        
        return analysisId;
        
    } catch (error) {
        console.error('分析結果の保存中にエラーが発生しました:', error);
        if (typeof showToast === 'function') {
            showToast('保存エラー', '分析結果の保存に失敗しました');
        }
        return null;
    }
}

/**
 * 保存された分析結果を取得する
 * @returns {Array} 分析結果の配列
 */
function getStoredAnalysisResults() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.ANALYSIS_RESULTS);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('分析結果の取得中にエラーが発生しました:', error);
        return [];
    }
}

/**
 * 特定の分析結果を取得する
 * @param {string} analysisId - 分析ID
 * @returns {Object|null} 分析結果オブジェクト
 */
function getAnalysisResultById(analysisId) {
    const results = getStoredAnalysisResults();
    return results.find(result => result.id === analysisId) || null;
}

/**
 * 分析履歴を更新する
 * @param {Object} analysisResult - 分析結果
 */
function updateAnalysisHistory(analysisResult) {
    try {
        const history = getAnalysisHistory();
        
        // 履歴エントリを作成
        const historyEntry = {
            id: analysisResult.id,
            timestamp: analysisResult.timestamp,
            date: analysisResult.dateFormatted,
            fieldName: analysisResult.field.name,
            healthStatus: analysisResult.evaluation.overall.status,
            ndviAverage: analysisResult.analysis.stats.ndvi.mean
        };
        
        // 履歴に追加
        history.unshift(historyEntry);
        
        // 最大件数の制限
        if (history.length > MAX_STORED_RESULTS) {
            history.splice(MAX_STORED_RESULTS);
        }
        
        localStorage.setItem(STORAGE_KEYS.ANALYSIS_HISTORY, JSON.stringify(history));
        
    } catch (error) {
        console.error('分析履歴の更新中にエラーが発生しました:', error);
    }
}

/**
 * 分析履歴を取得する
 * @returns {Array} 分析履歴の配列
 */
function getAnalysisHistory() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.ANALYSIS_HISTORY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('分析履歴の取得中にエラーが発生しました:', error);
        return [];
    }
}

/**
 * 分析IDを生成する
 * @param {number} timestamp - タイムスタンプ
 * @param {Object} fieldData - 圃場データ
 * @returns {string} 分析ID
 */
function generateAnalysisId(timestamp, fieldData) {
    const fieldId = fieldData?.id || fieldData?.name || 'unknown';
    const date = new Date(timestamp).toISOString().split('T')[0];
    const random = Math.random().toString(36).substr(2, 5);
    return `analysis_${fieldId}_${date}_${random}`;
}

/**
 * 保存用の健康状態評価を行う
 * @param {Object} stats - 統計データ
 * @returns {Object} 評価結果
 */
function evaluateFieldHealthForStorage(stats) {
    if (!stats) {
        return {
            overall: { status: '不明', class: 'bg-gray-100 text-gray-800' },
            ndvi: { status: '不明', class: 'bg-gray-100 text-gray-800' },
            ndmi: { status: '不明', class: 'bg-gray-100 text-gray-800' },
            ndre: { status: '不明', class: 'bg-gray-100 text-gray-800' }
        };
    }
    
    // 既存の評価関数を使用（既に定義されている場合）
    if (typeof evaluateFieldHealth === 'function') {
        return evaluateFieldHealth(stats);
    }
    
    // フォールバック評価
    const ndviStatus = evaluateIndexStatus(stats.ndvi?.mean, 'ndvi');
    const ndmiStatus = evaluateIndexStatus(stats.ndmi?.mean, 'ndmi');
    const ndreStatus = evaluateIndexStatus(stats.ndre?.mean, 'ndre');
    
    // 総合評価（簡易版）
    const statusValues = [ndviStatus, ndmiStatus, ndreStatus].map(s => getStatusValue(s.status));
    const avgStatus = statusValues.reduce((sum, val) => sum + val, 0) / statusValues.length;
    
    let overallStatus;
    if (avgStatus >= 2.5) {
        overallStatus = { status: '良好', class: 'bg-green-100 text-green-800' };
    } else if (avgStatus >= 1.5) {
        overallStatus = { status: '普通', class: 'bg-yellow-100 text-yellow-800' };
    } else {
        overallStatus = { status: '要注意', class: 'bg-red-100 text-red-800' };
    }
    
    return {
        overall: overallStatus,
        ndvi: ndviStatus,
        ndmi: ndmiStatus,
        ndre: ndreStatus
    };
}

/**
 * 植生指標の評価（簡易版）
 * @param {number|string} value - 指標値
 * @param {string} indexType - 指標タイプ
 * @returns {Object} 評価結果
 */
function evaluateIndexStatus(value, indexType) {
    if (value === '-' || value === null || value === undefined) {
        return { status: '不明', class: 'bg-gray-100 text-gray-800' };
    }
    
    const val = parseFloat(value);
    if (isNaN(val)) {
        return { status: '不明', class: 'bg-gray-100 text-gray-800' };
    }
    
    // 簡易的な閾値（実際の値は config.js から取得する方が良い）
    let goodThreshold, moderateThreshold;
    
    switch (indexType) {
        case 'ndvi':
            goodThreshold = 0.6;
            moderateThreshold = 0.3;
            break;
        case 'ndmi':
            goodThreshold = 0.3;
            moderateThreshold = 0.1;
            break;
        case 'ndre':
            goodThreshold = 0.2;
            moderateThreshold = 0.1;
            break;
        default:
            goodThreshold = 0.6;
            moderateThreshold = 0.3;
    }
    
    if (val >= goodThreshold) {
        return { status: '良好', class: 'bg-green-100 text-green-800' };
    } else if (val >= moderateThreshold) {
        return { status: '普通', class: 'bg-yellow-100 text-yellow-800' };
    } else {
        return { status: '要注意', class: 'bg-red-100 text-red-800' };
    }
}

/**
 * ステータスの数値化
 * @param {string} status - ステータス
 * @returns {number} 数値
 */
function getStatusValue(status) {
    switch (status) {
        case '良好': return 3;
        case '普通': return 2;
        case '要注意': return 1;
        default: return 0;
    }
}

/**
 * 保存された分析結果を削除する
 * @param {string} analysisId - 分析ID
 * @returns {boolean} 削除成功フラグ
 */
function deleteAnalysisResult(analysisId) {
    try {
        const results = getStoredAnalysisResults();
        const filteredResults = results.filter(result => result.id !== analysisId);
        
        if (filteredResults.length < results.length) {
            localStorage.setItem(STORAGE_KEYS.ANALYSIS_RESULTS, JSON.stringify(filteredResults));
            
            // 履歴からも削除
            const history = getAnalysisHistory();
            const filteredHistory = history.filter(entry => entry.id !== analysisId);
            localStorage.setItem(STORAGE_KEYS.ANALYSIS_HISTORY, JSON.stringify(filteredHistory));
            
            console.log('分析結果を削除しました:', analysisId);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('分析結果の削除中にエラーが発生しました:', error);
        return false;
    }
}

/**
 * すべての分析結果をクリアする
 * @returns {boolean} クリア成功フラグ
 */
function clearAllAnalysisResults() {
    try {
        localStorage.removeItem(STORAGE_KEYS.ANALYSIS_RESULTS);
        localStorage.removeItem(STORAGE_KEYS.ANALYSIS_HISTORY);
        console.log('すべての分析結果をクリアしました');
        return true;
    } catch (error) {
        console.error('分析結果のクリア中にエラーが発生しました:', error);
        return false;
    }
}

/**
 * 分析結果をJSONファイルとしてエクスポートする
 * @param {string|null} analysisId - 特定の分析ID（nullの場合はすべて）
 */
function exportAnalysisResults(analysisId = null) {
    try {
        let data;
        let filename;
        
        if (analysisId) {
            // 特定の分析結果をエクスポート
            data = getAnalysisResultById(analysisId);
            if (!data) {
                throw new Error('指定された分析結果が見つかりません');
            }
            filename = `analysis_result_${analysisId}.json`;
        } else {
            // すべての分析結果をエクスポート
            data = {
                results: getStoredAnalysisResults(),
                history: getAnalysisHistory(),
                exportDate: new Date().toISOString(),
                version: '1.0'
            };
            filename = `agrilens_analysis_export_${new Date().toISOString().split('T')[0]}.json`;
        }
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('分析結果をエクスポートしました:', filename);
        
        if (typeof showToast === 'function') {
            showToast('エクスポート完了', `分析結果を ${filename} としてダウンロードしました`);
        }
        
    } catch (error) {
        console.error('分析結果のエクスポート中にエラーが発生しました:', error);
        if (typeof showToast === 'function') {
            showToast('エクスポートエラー', error.message);
        }
    }
}

/**
 * 分析結果統計情報を取得する
 * @returns {Object} 統計情報
 */
function getAnalysisStatistics() {
    try {
        const results = getStoredAnalysisResults();
        
        if (results.length === 0) {
            return {
                total: 0,
                healthStatusCounts: {},
                averageNdvi: 0,
                dateRange: null
            };
        }
        
        // 健康状態の集計
        const healthStatusCounts = {};
        let ndviSum = 0;
        let ndviCount = 0;
        
        results.forEach(result => {
            const status = result.evaluation?.overall?.status || '不明';
            healthStatusCounts[status] = (healthStatusCounts[status] || 0) + 1;
            
            const ndviMean = parseFloat(result.analysis?.stats?.ndvi?.mean);
            if (!isNaN(ndviMean)) {
                ndviSum += ndviMean;
                ndviCount++;
            }
        });
        
        return {
            total: results.length,
            healthStatusCounts,
            averageNdvi: ndviCount > 0 ? (ndviSum / ndviCount).toFixed(3) : 0,
            dateRange: {
                oldest: results[results.length - 1]?.dateFormatted || null,
                newest: results[0]?.dateFormatted || null
            }
        };
        
    } catch (error) {
        console.error('統計情報の取得中にエラーが発生しました:', error);
        return {
            total: 0,
            healthStatusCounts: {},
            averageNdvi: 0,
            dateRange: null
        };
    }
}

// グローバルオブジェクトに関数を登録
window.AnalysisStorage = {
    save: saveAnalysisResult,
    getAll: getStoredAnalysisResults,
    getById: getAnalysisResultById,
    getHistory: getAnalysisHistory,
    delete: deleteAnalysisResult,
    clear: clearAllAnalysisResults,
    export: exportAnalysisResults,
    getStatistics: getAnalysisStatistics
};

console.log('Analysis Storage module loaded successfully');