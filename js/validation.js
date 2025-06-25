// NDVI検証機能

// リファレンスデータソース設定
const REFERENCE_DATA_SOURCES = {
    JAPAN_NARO: {
        name: "農研機構データ",
        url: "https://agri-info.naro.go.jp/api/v1/ndvi",
        apiKey: null, // 必要に応じて設定
        enabled: true
    },
    GLOBAL_COPERNICUS: {
        name: "COPERNICUS データ",
        url: "https://land.copernicus.vgt.vito.be/REST/",
        apiKey: null, // 必要に応じて設定
        enabled: true
    }
};

// 特定座標のリファレンスNDVI値を取得
async function fetchReferenceNdviData(lat, lon, startDate, endDate) {
    console.log("[VALIDATION] リファレンスNDVI取得開始:", lat, lon);
    
    try {
        // 表示用のトースト
        showToast("検証データ取得中", "参照データを取得しています...");
        
        // 複数のデータソースから並行して取得
        const promises = [];
        
        // 農研機構のデータ取得（利用可能であれば）
        if (REFERENCE_DATA_SOURCES.JAPAN_NARO.enabled) {
            promises.push(fetchNaroData(lat, lon, startDate, endDate));
        }
        
        // COPERNICUSデータ取得（利用可能であれば）
        if (REFERENCE_DATA_SOURCES.GLOBAL_COPERNICUS.enabled) {
            promises.push(fetchCopernicusData(lat, lon, startDate, endDate));
        }
        
        // モックデータの使用（デモ用）
        promises.push(getMockReferenceData(lat, lon, startDate, endDate));
        
        // すべてのデータ取得を待機
        const results = await Promise.allSettled(promises);
        
        // 成功したリクエストからデータを抽出
        const validResults = results
            .filter(result => result.status === 'fulfilled' && result.value)
            .map(result => result.value);
        
        if (validResults.length === 0) {
            throw new Error("有効なリファレンスデータが取得できませんでした");
        }
        
        console.log("[VALIDATION] 取得したリファレンスデータ:", validResults);
        return validResults;
    } catch (error) {
        console.error("[VALIDATION] リファレンスデータ取得エラー:", error);
        // エラー時もモックデータを返す
        return [await getMockReferenceData(lat, lon, startDate, endDate)];
    }
}

// 農研機構からのデータ取得（実際のAPIが利用可能になったら実装）
async function fetchNaroData(lat, lon, startDate, endDate) {
    // 注: 実際のAPIは存在しないため、モック実装
    // 本来はfetchを使って実際のAPIからデータを取得
    
    // モックデータを返す
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                source: "NARO",
                sourceFullName: "農研機構データ",
                location: { lat, lon },
                dateRange: { start: startDate, end: endDate },
                cropType: "rice", // 実際には取得または推定
                ndviValues: generateMockTimeSeriesData(startDate, endDate, 0.6, 0.1),
                average: 0.64,
                reliability: "high"
            });
        }, 800);
    });
}

// COPERNICUSからのデータ取得（実際のAPIが利用可能になったら実装）
async function fetchCopernicusData(lat, lon, startDate, endDate) {
    // 注: 実際のAPIアクセスには認証が必要
    // 本来はfetchを使って実際のAPIからデータを取得
    
    // モックデータを返す
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                source: "COPERNICUS",
                sourceFullName: "Copernicus Global Land Service",
                location: { lat, lon },
                dateRange: { start: startDate, end: endDate },
                cropType: "unknown",
                ndviValues: generateMockTimeSeriesData(startDate, endDate, 0.55, 0.15),
                average: 0.59,
                reliability: "medium"
            });
        }, 1200);
    });
}

// モックリファレンスデータの生成（デモ用）
async function getMockReferenceData(lat, lon, startDate, endDate) {
    // 緯度経度から簡易的に作物タイプを決定（実際には作物タイプDBを参照）
    const mockCropTypes = ["rice", "wheat", "soybean", "vegetables"];
    const seedValue = Math.abs(lat * 10 + lon * 100) % mockCropTypes.length;
    const cropType = mockCropTypes[Math.floor(seedValue)];
    
    // 作物タイプと時期に基づいた典型的NDVI値を生成
    let baseNdvi;
    let variability;
    
    switch(cropType) {
        case "rice":
            baseNdvi = 0.7;
            variability = 0.08;
            break;
        case "wheat":
            baseNdvi = 0.65;
            variability = 0.1;
            break;
        case "soybean":
            baseNdvi = 0.75;
            variability = 0.12;
            break;
        case "vegetables":
            baseNdvi = 0.6;
            variability = 0.15;
            break;
        default:
            baseNdvi = 0.65;
            variability = 0.1;
    }
    
    // 現在月に基づく季節係数（簡易実装）
    const month = new Date().getMonth();
    const seasonalFactor = getSeasonalFactor(month, cropType);
    const adjustedBase = baseNdvi * seasonalFactor;
    
    return {
        source: "REFERENCE_DB",
        sourceFullName: "リファレンスデータベース",
        location: { lat, lon },
        dateRange: { start: startDate, end: endDate },
        cropType,
        ndviValues: generateMockTimeSeriesData(startDate, endDate, adjustedBase, variability),
        average: adjustedBase,
        reliability: "medium",
        note: "このデータはデモ用モックデータです。実際の測定値ではありません。"
    };
}

// 月と作物タイプに基づく季節係数の計算
function getSeasonalFactor(month, cropType) {
    // 季節性の簡易実装（実際には作物カレンダーに基づく詳細な係数が必要）
    const seasons = {
        // 月ごとの係数 [1月, 2月, ..., 12月]
        rice: [0.3, 0.3, 0.4, 0.5, 0.7, 0.9, 1.0, 1.0, 0.9, 0.7, 0.5, 0.3],
        wheat: [0.8, 0.9, 1.0, 1.0, 0.9, 0.7, 0.5, 0.3, 0.3, 0.5, 0.6, 0.7],
        soybean: [0.3, 0.3, 0.4, 0.6, 0.8, 1.0, 1.0, 0.9, 0.7, 0.5, 0.4, 0.3],
        vegetables: [0.7, 0.7, 0.8, 0.9, 1.0, 1.0, 0.9, 0.9, 0.8, 0.8, 0.7, 0.7],
        default: [0.6, 0.6, 0.7, 0.8, 0.9, 1.0, 1.0, 0.9, 0.8, 0.7, 0.6, 0.6]
    };
    
    const factorArray = seasons[cropType] || seasons.default;
    return factorArray[month];
}

// 時系列データの生成（モック用）
function generateMockTimeSeriesData(startDate, endDate, baseMean, variability) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const sampleCount = Math.min(dayDiff, 30); // 最大30サンプル
    
    const timeSeriesData = [];
    for (let i = 0; i < sampleCount; i++) {
        const date = new Date(start);
        date.setDate(date.getDate() + Math.floor(i * dayDiff / sampleCount));
        
        const randomVariation = (Math.random() * 2 - 1) * variability;
        const ndviValue = Math.max(0, Math.min(1, baseMean + randomVariation));
        
        timeSeriesData.push({
            date: date.toISOString().split('T')[0],
            ndvi: ndviValue.toFixed(2)
        });
    }
    
    return timeSeriesData;
}

// 計測値とリファレンス値の比較
function compareWithReference(measuredData, referenceDataArray) {
    const results = referenceDataArray.map(refData => {
        // 測定値とリファレンス値の差異
        const measuredAvg = measuredData.stats.mean;
        const refAvg = refData.average;
        const difference = Math.abs(measuredAvg - refAvg);
        const percentDiff = (difference / refAvg) * 100;
        
        // 許容差異の計算（信頼性に応じて調整）
        let tolerancePercent = 15; // デフォルト15%
        if (refData.reliability === "high") {
            tolerancePercent = 10;
        } else if (refData.reliability === "low") {
            tolerancePercent = 25;
        }
        
        // 評価結果
        const isWithinTolerance = percentDiff <= tolerancePercent;
        
        // 評価ステータス
        let status;
        if (percentDiff <= tolerancePercent * 0.5) {
            status = "excellent";
        } else if (isWithinTolerance) {
            status = "good";
        } else if (percentDiff <= tolerancePercent * 1.5) {
            status = "questionable";
        } else {
            status = "poor";
        }
        
        return {
            referenceName: refData.sourceFullName,
            referenceValue: refAvg,
            measuredValue: measuredAvg,
            absoluteDifference: difference.toFixed(2),
            percentageDifference: percentDiff.toFixed(1),
            toleranceThreshold: tolerancePercent,
            status,
            isWithinTolerance,
            cropType: refData.cropType || "不明",
            details: refData
        };
    });
    
    return {
        comparisonResults: results,
        summary: generateComparisonSummary(results)
    };
}

// 比較結果のサマリー生成
function generateComparisonSummary(results) {
    // 全体評価の集計
    const statusCounts = results.reduce((counts, result) => {
        counts[result.status] = (counts[result.status] || 0) + 1;
        return counts;
    }, {});
    
    // 最も多い評価を全体評価とする
    let overallStatus = "unknown";
    let maxCount = 0;
    for (const status in statusCounts) {
        if (statusCounts[status] > maxCount) {
            maxCount = statusCounts[status];
            overallStatus = status;
        }
    }
    
    // 一致率の計算
    const matchCount = results.filter(r => r.isWithinTolerance).length;
    const matchPercentage = (matchCount / results.length) * 100;
    
    // 総合評価メッセージ
    let summaryMessage;
    if (matchPercentage >= 80) {
        summaryMessage = "測定値は参照データと高い一致を示しています。";
    } else if (matchPercentage >= 50) {
        summaryMessage = "測定値は参照データとある程度の一致を示していますが、一部不一致があります。";
    } else {
        summaryMessage = "測定値は参照データと大きく異なります。データの品質を確認してください。";
    }
    
    return {
        overallStatus,
        matchPercentage: matchPercentage.toFixed(0),
        summaryMessage,
        referencesCount: results.length
    };
}

// リファレンスデータと比較した結果の表示
function displayValidationResults(comparisonData) {
    showToast("検証完了", "リファレンスデータとの比較が完了しました");
    
    // 検証結果の表示エリアを取得または作成
    let validationResultsEl = document.getElementById('validationResults');
    if (!validationResultsEl) {
        validationResultsEl = document.createElement('div');
        validationResultsEl.id = 'validationResults';
        validationResultsEl.className = 'bg-white shadow-lg rounded-lg p-4 mt-4';
        
        // 分析結果の後に挿入
        const analysisResultsEl = document.getElementById('analysisResults');
        if (analysisResultsEl && analysisResultsEl.parentNode) {
            analysisResultsEl.parentNode.insertBefore(validationResultsEl, analysisResultsEl.nextSibling);
        } else {
            // 分析結果要素がない場合、マップの後に挿入
            const mapContainer = document.querySelector('.bg-white.shadow-lg.rounded-lg.overflow-hidden.relative');
            if (mapContainer && mapContainer.parentNode) {
                mapContainer.parentNode.insertBefore(validationResultsEl, mapContainer.nextSibling);
            }
        }
    }
    
    // サマリー情報の取得
    const summary = comparisonData.summary;
    const results = comparisonData.comparisonResults;
    
    // ステータスに応じたカラークラス
    const statusClasses = {
        excellent: 'bg-green-100 text-green-800',
        good: 'bg-blue-100 text-blue-800',
        questionable: 'bg-yellow-100 text-yellow-800',
        poor: 'bg-red-100 text-red-800',
        unknown: 'bg-gray-100 text-gray-800'
    };
    
    // HTML生成
    let html = `
        <div class="flex justify-between items-center mb-3">
            <h3 class="text-lg font-semibold text-gray-800">NDVI検証結果</h3>
            <span class="text-sm text-gray-500">検証時刻: ${new Date().toLocaleString()}</span>
        </div>
        
        <div class="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-3">
            <div class="flex items-center justify-between">
                <h4 class="font-medium text-blue-800">総合評価</h4>
                <span class="${statusClasses[summary.overallStatus] || 'bg-gray-100'} text-xs px-2 py-1 rounded">
                    参照データとの一致率: ${summary.matchPercentage}%
                </span>
            </div>
            <p class="mt-2 text-sm text-gray-700">${summary.summaryMessage}</p>
        </div>
        
        <h4 class="font-medium text-gray-800 mb-2">参照データ比較 (${results.length}件)</h4>
        <div class="overflow-x-auto">
            <table class="min-w-full bg-white border rounded-lg overflow-hidden">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">データソース</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">作物種</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">参照NDVI</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">測定NDVI</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">差異</th>
                        <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">評価</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
    `;
    
    // 各比較結果の行を追加
    results.forEach(result => {
        html += `
            <tr>
                <td class="px-4 py-2 text-sm">${result.referenceName}</td>
                <td class="px-4 py-2 text-sm">${result.cropType}</td>
                <td class="px-4 py-2 text-sm">${result.referenceValue}</td>
                <td class="px-4 py-2 text-sm">${result.measuredValue}</td>
                <td class="px-4 py-2 text-sm">${result.percentageDifference}%</td>
                <td class="px-4 py-2 text-sm">
                    <span class="${statusClasses[result.status] || 'bg-gray-100'} text-xs px-2 py-1 rounded">
                        ${getStatusJapanese(result.status)}
                    </span>
                </td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        
        <div class="mt-3 text-xs text-gray-500">
            <p>※ このデータはデモンストレーション用です。実際の参照データとは異なる場合があります。</p>
            <p>※ 評価基準: 優良(±10%), 良好(±15%), 要確認(±25%), 不一致(25%超)</p>
        </div>
    `;
    
    validationResultsEl.innerHTML = html;
    validationResultsEl.classList.remove('hidden');
}

// ステータスの日本語表示
function getStatusJapanese(status) {
    const statusMap = {
        excellent: '優良',
        good: '良好',
        questionable: '要確認',
        poor: '不一致',
        unknown: '不明'
    };
    return statusMap[status] || '不明';
}

// デモ用 - 検証機能をUIに追加（無効化）
function addValidationButton() {
    console.log("[VALIDATION] 検証ボタンは無効化されています");
    return;
    
    // ボタンのイベントリスナー
    validateBtn.addEventListener('click', async () => {
        console.log("[VALIDATION] 検証ボタンがクリックされました");
        
        // 最後の分析データを取得
        const lastAnalysisData = window.lastAnalysisResult;
        console.log("[VALIDATION] 最後の分析データ:", lastAnalysisData);
        
        if (!lastAnalysisData) {
            showToast("エラー", "検証には先に分析を実行してください", 3000);
            return;
        }
        
        try {
            // 現在選択されている地点の座標を取得
            let lat, lon;
            
            // グローバル変数からmapオブジェクトを取得
            if (window.map) {
                const center = window.map.getCenter();
                lat = center.lat;
                lon = center.lng;
                console.log("[VALIDATION] マップ中心座標:", lat, lon);
            } else {
                // マップオブジェクトが見つからない場合はデフォルト座標を使用
                console.warn("[VALIDATION] マップオブジェクトが見つかりません、デフォルト座標を使用");
                lat = 35.6895;  // 東京
                lon = 139.6917;
            }
            
            // 日付範囲を取得（最後の分析から、または現在から過去30日）
            let startDate, endDate;
            if (lastAnalysisData.dateRange) {
                startDate = lastAnalysisData.dateRange.start;
                endDate = lastAnalysisData.dateRange.end;
            } else {
                const now = new Date();
                endDate = now.toISOString().split('T')[0];
                now.setDate(now.getDate() - 30);
                startDate = now.toISOString().split('T')[0];
            }
            
            // リファレンスデータを取得
            const referenceData = await fetchReferenceNdviData(lat, lon, startDate, endDate);
            
            // 計測値と比較
            const comparison = compareWithReference(lastAnalysisData, referenceData);
            
            // 結果を表示
            displayValidationResults(comparison);
            
        } catch (error) {
            console.error("検証処理エラー:", error);
            showToast("検証エラー", error.message || "NDVI検証中にエラーが発生しました", 5000);
        }
    });
    
    // 分析結果があれば有効化
    window.addEventListener('analysisCompleted', () => {
        validateBtn.disabled = false;
    });
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    console.log("[VALIDATION] DOMContentLoaded イベント発火 - 初期化開始");
    
    // 検証ボタンを追加
    addValidationButton();
    
    // グローバル分析完了イベントリスナーを設定
    console.log("[VALIDATION] analysisCompletedイベントリスナーを設定");
    document.addEventListener('analysisCompleted', (event) => {
        console.log("[VALIDATION] analysisCompletedイベントを受信:", event.detail);
        
        // 分析結果をグローバル変数に保存
        window.lastAnalysisResult = event.detail;
        console.log("[VALIDATION] グローバル変数に分析結果を保存:", window.lastAnalysisResult);
        
        // 検証ボタンを有効化
        const validateBtn = document.getElementById('validateBtn');
        if (validateBtn) {
            console.log("[VALIDATION] 検証ボタンを有効化");
            validateBtn.disabled = false;
        } else {
            console.warn("[VALIDATION] 検証ボタンが見つかりません");
        }
    });
    
    console.log("[VALIDATION] 初期化完了");
}); 