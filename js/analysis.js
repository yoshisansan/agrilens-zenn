// 分析データの取得（サーバーサイドAPIを使用）
async function fetchGEEAnalysis(aoiGeoJSON) {
    console.log("Sending AOI to server:", aoiGeoJSON);
    showProcessingModal("圃場分析を処理中", "Google Earth Engineに接続しています...");
    
    // 実際の処理状況を反映するプログレスバー（初期値）
    updateProgressBar(10);

    try {
        // GeoJSONデータの検証
        if (!aoiGeoJSON) {
            hideProcessingModal(); // 処理中モーダルを明示的に閉じる
            throw new Error("GeoJSONデータがありません");
        }
        
        // GeoJSONのFeatureからジオメトリを抽出
        let geometryData = aoiGeoJSON;
        
        // Featureの場合、ジオメトリを抽出
        if (aoiGeoJSON.type === 'Feature' && aoiGeoJSON.geometry) {
            geometryData = aoiGeoJSON.geometry;
            console.log('Featureからジオメトリを抽出:', geometryData.type);
        }
        
        // 座標データの確認
        if (!geometryData.coordinates || !Array.isArray(geometryData.coordinates)) {
            console.error('無効な座標データ:', geometryData);
            hideProcessingModal(); // 処理中モーダルを明示的に閉じる
            throw new Error("座標データがないか無効です");
        }
        
        console.log('GEEに送信するジオメトリデータ:', JSON.stringify(geometryData));
        updateProgressBar(20);
        showProcessingModal("圃場分析を処理中", "GEEで衛星画像を検索中...");

        // リクエストの作成と送信
        const requestBody = { aoiGeoJSON: geometryData };
        console.log('送信リクエスト:', JSON.stringify(requestBody));
        updateProgressBar(30);

        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        updateProgressBar(70);
        showProcessingModal("圃場分析を処理中", "GEEからのデータを処理中...");

        // ステータスコードとレスポンスデータを取得
        const responseData = await response.json();
        console.log('GEEからのレスポンス:', responseData);
        updateProgressBar(90);

        if (!response.ok) {
            hideProcessingModal(); // 処理中モーダルを明示的に閉じる
            
            if (response.status === 401) {
                // 認証が必要な場合、認証ページにリダイレクト
                window.location.href = '/auth';
                return;
            }
            
            // サーバーから返されたエラーメッセージを表示
            const errorMessage = responseData.error || `HTTP error! status: ${response.status}`;
            const errorDetails = responseData.details || '';
            
            showToast("エラーが発生しました", `${errorMessage}\n${errorDetails}`);
            throw new Error(errorMessage);
        }

        updateProgressBar(100);
        hideProcessingModal(); // 処理完了時にモーダルを明示的に閉じる
        return responseData;

    } catch (error) {
        console.error('GEE分析中にエラーが発生しました:', error);
        hideProcessingModal(); // エラー時にモーダルを明示的に閉じる
        
        // 認証エラーメッセージの場合
        if (error.message && (
            error.message.includes('authentication credential') || 
            error.message.includes('OAuth') ||
            error.message.includes('Earth Engine')
        )) {
            showToast("認証エラー", "Google Earth Engineへの認証に失敗しました。モックデータを使用します。");
            // モックデータを返す
            console.log("[DEBUG] 認証エラー - モックデータを返します");
            return createLocalMockData(aoiGeoJSON);
        }
        showToast("エラーが発生しました", `GEE分析中にエラーが発生しました: ${error.message}`);
        throw error;
    }
}

// GEEからの統計データを整形する関数
function processIndicesStats(rawStats) {
    const processed = {
        ndvi: {},
        ndmi: {},
        ndre: {}
    };

    if (rawStats) {
        for (const key in rawStats) {
            if (rawStats.hasOwnProperty(key)) {
                const parts = key.split('_'); // 例: "NDVI_mean" -> ["NDVI", "mean"]
                if (parts.length === 2) {
                    const indexName = parts[0].toLowerCase(); // "ndvi", "ndmi", "ndre"
                    const statName = parts[1]; // "mean", "min", "max", "stdDev"
                    
                    if (processed.hasOwnProperty(indexName)) {
                        // GEEのキー (e.g., NDVI_stdDev) に合わせて小文字のstatNameをそのまま使う
                        processed[indexName][statName] = rawStats[key];
                    }
                }
            }
        }
    }
    console.log("Processed stats:", processed); // デバッグ用ログ
    return processed;
}

// 分析結果の表示
// 植生指標レイヤーの処理
function processVegetationLayers(data) {
    addVegetationIndicesLayers(data);
    console.log("渡されている data の内容:", JSON.stringify(data, null, 2));
}

// 統計データの処理と表示
function processAndDisplayStats(data) {
    const stats = processIndicesStats(data.stats);
    
    const formatNumber = (value) => {
        if (typeof value === 'string' && value === '-') return '-';
        const num = parseFloat(value);
        const config = window.ModuleManager?.get('config') || window.CONFIG;
        const places = config?.UI?.DEFAULT_DECIMAL_PLACES || 3;
        return isNaN(num) ? '-' : num.toFixed(places);
    };
    
    console.log('GEE分析統計データ:', {
        植生指標: {
            NDVI: {
                平均: formatNumber(stats.ndvi.mean),
                標準偏差: formatNumber(stats.ndvi.stdDev),
                最小: formatNumber(stats.ndvi.min),
                最大: formatNumber(stats.ndvi.max)
            },
            NDMI: {
                平均: formatNumber(stats.ndmi.mean),
                標準偏差: formatNumber(stats.ndmi.stdDev),
                最小: formatNumber(stats.ndmi.min),
                最大: formatNumber(stats.ndmi.max)
            },
            NDRE: {
                平均: formatNumber(stats.ndre.mean),
                標準偏差: formatNumber(stats.ndre.stdDev),
                最小: formatNumber(stats.ndre.min),
                最大: formatNumber(stats.ndre.max)
            }
        },
        日付範囲: data.dateRange
    });
    
    return stats;
}

// UI更新処理
function updateAnalysisUI(stats, dateRange) {
    const evaluation = evaluateFieldHealth(stats);
    updateHealthSummary(evaluation, stats);
    updateAiComment(evaluation, stats);
    updateDetailedStats(stats, dateRange);
    
    // 分析結果パネルの表示
    if (analysisResultsEl) {
        analysisResultsEl.classList.add('hidden');
        const config = window.ModuleManager?.get('config') || window.CONFIG;
        const delay = config?.UI?.PANEL_ANIMATION_DELAY || 50;
        setTimeout(() => {
            analysisResultsEl.classList.remove('hidden');
        }, delay);
    }
    
    // 生成時刻を更新
    const timeEl = document.getElementById('analysisGeneratedTime');
    if (timeEl) {
        timeEl.textContent = `生成時刻: ${new Date().toLocaleString()}`;
    }
}

// 分析完了処理
function handleAnalysisCompletion(data, stats) {
    const formatNumber = (value) => {
        if (typeof value === 'string' && value === '-') return '-';
        const num = parseFloat(value);
        const config = window.ModuleManager?.get('config') || window.CONFIG;
        const places = config?.UI?.DEFAULT_DECIMAL_PLACES || 3;
        return isNaN(num) ? '-' : num.toFixed(places);
    };
    
    if (!data.ndviTileUrlTemplate && !data.ndmiTileUrlTemplate && !data.ndreTileUrlTemplate) {
        showToast("注意", "マップ表示用の植生指標レイヤーを生成できませんでしたが、統計データは分析できました。");
    } else {
        showToast("分析完了", `植生指標分析が完了しました。NDVI: ${formatNumber(stats.ndvi.mean)}、NDMI: ${formatNumber(stats.ndmi.mean)}、NDRE: ${formatNumber(stats.ndre.mean)}`);
    }
    
    prepareAiAdviceTab();
    
    const analysisCompletedEvent = new CustomEvent('analysisCompleted', { 
        detail: { 
            dateRange: data.dateRange,
            stats: stats
        }
    });
    document.dispatchEvent(analysisCompletedEvent);
}

function displayAnalysisResults(data) {
    console.log("GEEから受信した分析データ:", data);
    
    let savedAnalysisId = null;
    
    // 植生指標レイヤーの処理
    processVegetationLayers(data);
    
    // 統計データの処理と表示
    const stats = processAndDisplayStats(data);
    
    // UI更新
    updateAnalysisUI(stats, data.dateRange);
    
    // 完了処理
    handleAnalysisCompletion(data, stats);
    
    // AIアドバイス処理
    handleAiAdviceProcessing(stats, savedAnalysisId, data);
}

// AIアドバイス処理メイン関数
function handleAiAdviceProcessing(stats, savedAnalysisId, data) {
    const fieldData = getCurrentFieldDataForAnalysis();
    console.log('圃場データ取得成功:', fieldData);
    
    if (!fieldData) {
        handleNoFieldData();
        return;
    }
    
    if (typeof window.getGeminiAdvice !== 'function') {
        handleDummyAdvice();
        return;
    }
    
    processGeminiAdvice(stats, fieldData, savedAnalysisId, data);
}

// 圃場データがない場合の処理
function handleNoFieldData() {
    console.warn('AIアドバイス取得のための圃場データがありません。');
    const aiRecommendations = document.getElementById('aiRecommendations');
    if (aiRecommendations) {
        aiRecommendations.innerHTML = '<p class=\"text-yellow-500\">AIアドバイスを生成するための圃場情報が選択されていません。</p>';
    }
}

// ダミーアドバイス表示処理
function handleDummyAdvice() {
    console.warn('getGeminiAdvice関数が見つからないため、ダミーアドバイスを生成します');
    const dummyAdvice = {
        "重要な知見のまとめ": "NDVI値、NDMI値、NDRE値に基づく分析結果から、全体的に圃場は正常な状態と評価されます。定期的なモニタリングを継続してください。"
    };
    
    const aiRecommendations = document.getElementById('aiRecommendations');
    if (aiRecommendations) {
        let adviceContent = '<h3 class=\"text-lg font-semibold mb-2\">AIによる詳細アドバイス</h3>';
        if (dummyAdvice.重要な知見のまとめ) {
            adviceContent += `<p class=\"mb-2\"><strong>重要な知見のまとめ:</strong> ${dummyAdvice.重要な知見のまとめ}</p>`;
        }
        aiRecommendations.innerHTML = adviceContent;
    }
}

// Gemini APIアドバイス処理
function processGeminiAdvice(stats, fieldData, savedAnalysisId, data) {
    const simplifiedStats = {
        ndvi: stats.ndvi.mean || 0,
        ndmi: stats.ndmi.mean || 0,
        ndre: stats.ndre.mean || 0
    };
    
    console.log('AIに送信する単純化された統計データ:', simplifiedStats);
    
    try {
        window.getGeminiAdvice(simplifiedStats, fieldData)
            .then(advice => handleAdviceSuccess(advice, savedAnalysisId, data, stats))
            .catch(error => handleAdviceError(error));
    } catch (error) {
        handleAdviceError(error);
    }
}

// アドバイス取得成功時の処理
function handleAdviceSuccess(advice, savedAnalysisId, data, stats) {
    console.log('AIアドバイス取得成功:', advice);
    
    updateGlobalData(advice, data, stats);
    updateLocalStorage(advice, savedAnalysisId);
    displayAdviceUI(advice);
    
    // データ保存とUI更新
    saveAnalysisData(data, stats, savedAnalysisId);
    updateHistorySections();
}

// グローバルデータ更新
function updateGlobalData(advice, data, stats) {
    if (window.latestAnalysisData) {
        window.latestAnalysisData.advice = advice;
    } else {
        window.latestAnalysisData = {
            dateRange: data.dateRange,
            stats: stats,
            advice: advice
        };
    }
}

// ローカルストレージ更新
function updateLocalStorage(advice, savedAnalysisId) {
    if (savedAnalysisId && window.AnalysisStorage) {
        try {
            const existingResult = window.AnalysisStorage.getById(savedAnalysisId);
            if (existingResult) {
                existingResult.aiAdvice = advice;
                const results = window.AnalysisStorage.getAll();
                const resultIndex = results.findIndex(r => r.id === savedAnalysisId);
                if (resultIndex !== -1) {
                    results[resultIndex] = existingResult;
                    localStorage.setItem('agrilens_analysis_results', JSON.stringify(results));
                    console.log('AIアドバイスでローカルストレージを更新しました');
                }
            }
        } catch (error) {
            console.error('AIアドバイス保存中にエラーが発生しました:', error);
        }
    }
}

// アドバイスUI表示
function displayAdviceUI(advice) {
    const aiRecommendations = document.getElementById('aiRecommendations');
    if (!aiRecommendations) {
        console.error('aiRecommendations element not found');
        return;
    }
    
    if (advice && !advice.error) {
        aiRecommendations.innerHTML = buildAdviceHTML(advice);
    } else {
        aiRecommendations.innerHTML = `<p class=\"text-red-500\">AIアドバイスの取得に失敗しました。${advice && advice.message ? advice.message : ''}</p>`;
    }
}

// アドバイスHTML構築
function buildAdviceHTML(advice) {
    let adviceContent = buildAdviceHeader();
    
    if (advice.重要な知見のまとめ) {
        adviceContent += buildSummaryCard(advice.重要な知見のまとめ);
    }
    
    if (advice.詳細な評価) {
        adviceContent += buildDetailedEvaluation(advice.詳細な評価);
    }
    
    if (advice.具体的な対策 && advice.具体的な対策.length > 0) {
        adviceContent += buildActionPlan(advice.具体的な対策);
    }
    
    if (advice.今後の管理ポイント && advice.今後の管理ポイント.length > 0) {
        adviceContent += buildManagementPoints(advice.今後の管理ポイント);
    }
    
    adviceContent += buildTimestamp();
    
    return adviceContent;
}

// ヘッダー構築
function buildAdviceHeader() {
    return window.AnalysisTemplates ? window.AnalysisTemplates.analysisHeader() : 
        `<div class="mb-4">
            <h3 class="text-lg font-semibold mb-1 text-center bg-green-100 py-2 rounded-t-lg border-b border-green-200">
                圃場の健康状態と対策
            </h3>
        </div>`;
}

// サマリーカード構築
function buildSummaryCard(summary) {
    return window.AnalysisTemplates ? window.AnalysisTemplates.summaryCard(summary) :
        `<div class="mb-4 p-4 bg-green-50 rounded-lg border border-green-100">
            <div class="flex items-start">
                <div class="mr-2">
                    <span class="inline-block bg-green-100 p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                        </svg>
                    </span>
                </div>
                <div>
                    <h4 class="font-semibold text-green-800 mb-1">重要な知見のまとめ</h4>
                    <p class="text-sm text-gray-700">${summary}</p>
                </div>
            </div>
        </div>`;
}

// 詳細評価セクション構築  
function buildDetailedEvaluation(evaluation) {
    let content = window.AnalysisTemplates ? 
        window.AnalysisTemplates.detailedEvaluationHeader() :
        `<div class="mb-2"><h4 class="font-semibold text-gray-700" id="detailedEvaluation">詳細な評価</h4></div>`;
    
    if (evaluation.NDMI) {
        content += buildNDMICard(evaluation.NDMI);
    }
    
    if (evaluation.NDRE) {
        content += buildNDRECard(evaluation.NDRE);
    }
    
    return content;
}

// NDMIカード構築
function buildNDMICard(ndmi) {
    return window.AnalysisTemplates ? window.AnalysisTemplates.ndmiCard(ndmi) :
        `<div class="mb-3 p-4 bg-yellow-50 rounded-lg">
            <div class="flex justify-between items-center mb-2">
                <div class="flex items-center">
                    <span class="inline-block text-yellow-500 mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" />
                        </svg>
                    </span>
                    <h5 class="font-semibold text-gray-700">水分ストレス (NDMI)</h5>
                </div>
                <span class="text-yellow-600 font-medium bg-yellow-100 px-2 py-1 rounded-full text-xs">数値 ${ndmi.value?.toFixed(2) || '0.00'}</span>
            </div>
            <p class="text-sm text-gray-600">${ndmi.text}</p>
        </div>`;
}

// NDREカード構築
function buildNDRECard(ndre) {
    return window.AnalysisTemplates ? window.AnalysisTemplates.ndreCard(ndre) :
        `<div class="mb-3 p-4 bg-gray-50 rounded-lg">
            <div class="flex justify-between items-center mb-2">
                <div class="flex items-center">
                    <span class="inline-block text-gray-500 mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1z" clip-rule="evenodd" />
                        </svg>
                    </span>
                    <h5 class="font-semibold text-gray-700">根類状態 (NDRE)</h5>
                </div>
                <span class="text-gray-600 font-medium bg-gray-200 px-2 py-1 rounded-full text-xs">数値 ${ndre.value?.toFixed(2) || '0.00'}</span>
            </div>
            <p class="text-sm text-gray-600">${ndre.text}</p>
        </div>`;
}

// 対策プラン構築
function buildActionPlan(actions) {
    return window.AnalysisTemplates ? window.AnalysisTemplates.actionPlan(actions) : 
        buildFallbackActionPlan(actions);
}

// フォールバック用対策プラン
function buildFallbackActionPlan(actions) {
    return `<div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
        <div class="flex items-center mb-2">
            <span class="inline-block text-blue-600 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
            </span>
            <h4 class="font-semibold text-blue-800">具体的な対策</h4>
        </div>
        <ul class="list-none pl-8">
            ${actions.map(item => `
                <li class="mb-2 flex items-start">
                    <span class="inline-block text-blue-600 mr-2 mt-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </span>
                    <span class="text-gray-700 text-sm">${item}</span>
                </li>
            `).join('')}
        </ul>
    </div>`;
}

// 管理ポイント構築
function buildManagementPoints(points) {
    return window.AnalysisTemplates ? window.AnalysisTemplates.managementPoints(points) :
        buildFallbackManagementPoints(points);
}

// フォールバック用管理ポイント
function buildFallbackManagementPoints(points) {
    return `<div class="mb-2 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
        <div class="flex items-center mb-2">
            <span class="inline-block text-yellow-600 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </span>
            <h4 class="font-semibold text-yellow-800">今後の管理ポイント</h4>
        </div>
        <ul class="list-none pl-8">
            ${points.map(item => `
                <li class="mb-2 flex items-start">
                    <span class="inline-block text-yellow-600 mr-2 mt-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </span>
                    <span class="text-gray-700 text-sm">${item}</span>
                </li>
            `).join('')}
        </ul>
    </div>`;
}

// タイムスタンプ構築
function buildTimestamp() {
    return window.AnalysisTemplates ? window.AnalysisTemplates.timestamp() :
        `<div class="text-right text-xs text-gray-400 mt-4">
            分析生成: ${new Date().toLocaleString('ja-JP')}
        </div>`;
}

// データ保存処理
function saveAnalysisData(data, stats, savedAnalysisId) {
    if (typeof window.AnalysisStorage !== 'undefined' && !window.isDisplayingStoredResult) {
        try {
            const fieldData = getCurrentFieldDataForAnalysis();
            if (!savedAnalysisId) {
                savedAnalysisId = window.AnalysisStorage.save(
                    {
                        dateRange: data.dateRange,
                        stats: stats,
                        ndviTileUrlTemplate: data.ndviTileUrlTemplate,
                        ndmiTileUrlTemplate: data.ndmiTileUrlTemplate,
                        ndreTileUrlTemplate: data.ndreTileUrlTemplate
                    },
                    fieldData,
                    null
                );
                
                if (savedAnalysisId) {
                    console.log('分析結果をローカルストレージに保存しました。ID:', savedAnalysisId);
                    addSaveIndicatorToResults(savedAnalysisId);
                }
            }
        } catch (error) {
            console.error('分析結果の保存中にエラーが発生しました:', error);
        }
    } else {
        console.warn('AnalysisStorage モジュールが読み込まれていません');
    }
}

// 履歴セクション更新
function updateHistorySections() {
    if (!window.isDisplayingStoredResult) {
        updateAnalysisHistorySection();
        
        if (window.AiAssistantHistory) {
            window.AiAssistantHistory.update();
        }
    }
}

// エラーハンドリング
function handleAdviceError(error) {
    console.error('Error fetching Gemini advice:', error);
    const aiRecommendations = document.getElementById('aiRecommendations');
    if (aiRecommendations) {
        if (error.message) {
            aiRecommendations.innerHTML = '<p class=\"text-red-500\">AIアドバイスの呼び出しエラー: ' + error.message + '</p>';
        } else {
            aiRecommendations.innerHTML = '<p class=\"text-red-500\">AIアドバイスの取得中にエラーが発生しました。</p>';
        }
    }
}


// AIアドバイスタブを初期表示用に準備
function prepareAiAdviceTab() {
    const aiRecommendations = document.getElementById('aiRecommendations');

    // Gemini APIキーが環境変数に設定されているか確認
    const hasApiKey = window.ENV && window.ENV.GEMINI_API_KEY;

    // メインのAIコメント領域にローディング表示
    if (aiRecommendations) {
        // すでに内容がある場合は上書きしない
        if (aiRecommendations.textContent.includes('分析結果を読み込み中') || aiRecommendations.innerHTML.includes('animate-spin')) {
            aiRecommendations.innerHTML = `
            <div class="flex justify-center items-center py-6">
                <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mr-3"></div>
                <p class="text-gray-600 text-lg">AIアドバイスを生成中...</p>
            </div>`;
        }
    }

    // APIキーがない場合の警告表示
    if (!hasApiKey && aiRecommendations) {
        aiRecommendations.innerHTML = `
        <div class="text-center p-6 bg-yellow-50 rounded-lg border border-yellow-200">
            <div class="text-yellow-600 mb-3"><i class="fas fa-exclamation-triangle text-3xl"></i></div>
            <h4 class="font-medium mb-2 text-lg">Gemini APIキーが設定されていません</h4>
            <p class="mb-3">詳細な作物分析アドバイスを受け取るには、サーバー側の環境変数に Gemini APIキーを設定してください。</p>
        </div>`;
    }
}

// 分析用の圃場データを取得する
function getCurrentFieldDataForAnalysis() {
    console.log('=== getCurrentFieldDataForAnalysis 呼び出し ===');
    console.log('window.currentFieldId:', window.currentFieldId);
    console.log('getFieldById関数の存在:', typeof window.getFieldById);
    
    try {
        // 現在の圃場IDから圃場データを取得
        if (typeof window.currentFieldId !== 'undefined' && window.currentFieldId && 
            typeof window.getFieldById === 'function') {
            const fieldData = window.getFieldById(window.currentFieldId);
            console.log('getFieldByIdで取得したデータ:', fieldData);
            if (fieldData) {
                console.log('現在選択中の圃場データを使用:', fieldData);
                
                // ディレクトリ名を取得
                let displayName = fieldData.name || '区画';
                if (fieldData.directoryId && typeof window.getDirectoryById === 'function') {
                    console.log('ディレクトリIDで検索:', fieldData.directoryId);
                    const directory = window.getDirectoryById(fieldData.directoryId);
                    console.log('取得したディレクトリ:', directory);
                    if (directory && directory.name) {
                        displayName = `${directory.name} - ${fieldData.name || '区画'}`;
                        console.log('最終的な表示名:', displayName);
                    } else {
                        console.log('ディレクトリが見つからないか、名前がありません');
                    }
                } else {
                    console.log('ディレクトリIDがないか、getDirectoryById関数が存在しません');
                }
                
                return {
                    name: displayName,
                    latitude: fieldData.location ? fieldData.location.latitude : null,
                    longitude: fieldData.location ? fieldData.location.longitude : null,
                    crop: fieldData.crop || '不明',
                    region: fieldData.region || '日本',
                    area: fieldData.area || '不明',
                    directoryId: fieldData.directoryId || null
                };
            } else {
                console.log('getFieldByIdでデータが取得できませんでした');
            }
        } else {
            console.log('currentFieldIdが設定されていないか、getFieldById関数が存在しません');
        }
        
        // 現在選択中のレイヤーから情報を取得する試み
        if (typeof window.selectedFieldLayer !== 'undefined' && window.selectedFieldLayer && 
            window.selectedFieldLayer.feature && window.selectedFieldLayer.feature.properties) {
            const props = window.selectedFieldLayer.feature.properties;
            console.log('選択中のレイヤーから圃場データを使用:', props);
            
            // レイヤーのプロパティから圃場IDを取得し、ディレクトリ名と組み合わせ
            let displayName = props.name || props.title || '選択された圃場';
            if (props.fieldId && typeof window.getFieldById === 'function') {
                const fieldData = window.getFieldById(props.fieldId);
                if (fieldData && fieldData.directoryId && typeof window.getDirectoryById === 'function') {
                    const directory = window.getDirectoryById(fieldData.directoryId);
                    if (directory && directory.name) {
                        displayName = `${directory.name} - ${fieldData.name || '区画'}`;
                    }
                }
            }
            
            return {
                name: displayName,
                latitude: props.latitude || props.lat,
                longitude: props.longitude || props.lng,
                crop: props.crop || '不明',
                region: props.region || '日本',
                area: props.area || '不明'
            };
        }
        
        // フィールドリストから最初のフィールドを取得
        if (typeof window.getAllFields === 'function') {
            const allFields = window.getAllFields();
            if (allFields && allFields.length > 0) {
                const firstField = allFields[0];
                console.log('フィールドリストの最初の圃場を使用:', firstField);
                
                // ディレクトリ名と区画名を組み合わせ
                let displayName = firstField.name || '圃場1';
                if (firstField.directoryId && typeof window.getDirectoryById === 'function') {
                    const directory = window.getDirectoryById(firstField.directoryId);
                    if (directory && directory.name) {
                        displayName = `${directory.name} - ${firstField.name || '圃場1'}`;
                    }
                }
                
                return {
                    name: displayName,
                    latitude: firstField.location ? firstField.location.latitude : null,
                    longitude: firstField.location ? firstField.location.longitude : null,
                    crop: firstField.crop || '不明',
                    region: firstField.region || '日本',
                    area: firstField.area || '不明'
                };
            }
        }

        // 分析対象として描画されたエリアの情報を取得
        if (typeof window.drawnPolygons !== 'undefined' && window.drawnPolygons && window.drawnPolygons.length > 0) {
            const polygon = window.drawnPolygons[0]; // 最初の描画エリアを使用
            const center = getPolygonCenter(polygon);
            
            // 最近使用された圃場から推測
            let displayName = '手動分析エリア';
            if (typeof window.getAllFields === 'function') {
                const allFields = window.getAllFields();
                if (allFields && allFields.length > 0) {
                    // 最新の圃場を取得
                    const latestField = allFields.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
                    if (latestField && latestField.directoryId && typeof window.getDirectoryById === 'function') {
                        const directory = window.getDirectoryById(latestField.directoryId);
                        if (directory && directory.name) {
                            displayName = `${directory.name} - 手動分析エリア`;
                        }
                    }
                }
            }
            
            return {
                name: displayName,
                latitude: center.lat,
                longitude: center.lng,
                crop: '不明',
                region: '日本',
                area: calculatePolygonArea(polygon) + ' m²'
            };
        }
        
        // 地図の中心座標が利用可能な場合（最後のフォールバック）
        console.log('⚠️ フォールバック: 地図の中心座標を使用します');
        if (window.map && typeof window.map.getCenter === 'function') {
            const mapCenter = window.map.getCenter();
            
            // 最近使用された圃場から推測してディレクトリ名を取得
            let displayName = '未指定区画';
            if (typeof window.getAllFields === 'function') {
                const allFields = window.getAllFields();
                if (allFields && allFields.length > 0) {
                    // 最新の圃場を取得
                    const latestField = allFields.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
                    if (latestField && latestField.directoryId && typeof window.getDirectoryById === 'function') {
                        const directory = window.getDirectoryById(latestField.directoryId);
                        if (directory && directory.name) {
                            displayName = `${directory.name} - 未指定区画`;
                        }
                    }
                }
            }
            
            return {
                name: displayName,
                latitude: mapCenter.lat,
                longitude: mapCenter.lng,
                crop: '不明', 
                region: '日本',
                area: '不明'
            };
        }
        
        // 絶対に失敗しないようにデフォルト値を返す（最近の圃場から推測）
        console.log('⚠️ 最終フォールバック: デフォルト値を使用します');
        let displayName = 'デフォルト区画';
        if (typeof window.getAllFields === 'function') {
            const allFields = window.getAllFields();
            if (allFields && allFields.length > 0) {
                // 最新の圃場を取得
                const latestField = allFields.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
                if (latestField && latestField.directoryId && typeof window.getDirectoryById === 'function') {
                    const directory = window.getDirectoryById(latestField.directoryId);
                    if (directory && directory.name) {
                        displayName = `${directory.name} - デフォルト区画`;
                    }
                }
            }
        }
        
        return {
            name: displayName,
            latitude: 35.6895,  // 東京の座標
            longitude: 139.6917,
            crop: '不明',
            region: '日本',
            area: '不明'
        };
    } catch (error) {
        console.error('圃場データ取得中にエラーが発生しました:', error);
        
        // エラー時でも最近の圃場から推測を試みる
        let displayName = 'エラー時区画';
        try {
            if (typeof window.getAllFields === 'function') {
                const allFields = window.getAllFields();
                if (allFields && allFields.length > 0) {
                    // 最新の圃場を取得
                    const latestField = allFields.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
                    if (latestField && latestField.directoryId && typeof window.getDirectoryById === 'function') {
                        const directory = window.getDirectoryById(latestField.directoryId);
                        if (directory && directory.name) {
                            displayName = `${directory.name} - エラー時区画`;
                        }
                    }
                }
            }
        } catch (innerError) {
            console.error('ディレクトリ名の取得でもエラーが発生しました:', innerError);
        }
        
        return {
            name: displayName,
            latitude: 35.6895,
            longitude: 139.6917,
            crop: '不明',
            region: '日本',
            area: '不明'
        };
    }
}

// ポリゴンの中心座標を計算する関数
function getPolygonCenter(polygon) {
    let latSum = 0;
    let lngSum = 0;
    let pointCount = 0;
    
    if (polygon && polygon.latlngs && polygon.latlngs[0]) {
        const points = polygon.latlngs[0];
        for (const point of points) {
            latSum += point.lat;
            lngSum += point.lng;
            pointCount++;
        }
        
        return {
            lat: latSum / pointCount,
            lng: lngSum / pointCount
        };
    }
    
    // フォールバック
    return { lat: 35.6895, lng: 139.6917 };
}

// ポリゴンの面積を計算する関数（簡易版）
function calculatePolygonArea(polygon) {
    if (!polygon || !polygon.latlngs || !polygon.latlngs[0]) {
        return 0;
    }
    
    // Leafletのオブジェクトの場合は、getAreaメソッドが使える可能性がある
    if (typeof polygon.getArea === 'function') {
        return Math.round(polygon.getArea());
    }
    
    // 簡易的な面積計算（正確ではないが概算）
    const points = polygon.latlngs[0];
    if (points.length < 3) return 0;
    
    // 簡易的な計算として、点の数 × 1000m² として概算
    return points.length * 1000;
}

// 保存インジケーターを分析結果エリアに追加
function addSaveIndicatorToResults(analysisId) {
    try {
        const analysisResults = document.getElementById('analysisResults');
        if (!analysisResults) return;
        
        // 既存のインジケーターを削除
        const existingIndicator = analysisResults.querySelector('.save-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // 保存インジケーターを作成
        const saveIndicator = document.createElement('div');
        saveIndicator.className = 'save-indicator bg-green-50 border border-green-200 rounded-lg p-3 mb-4';
        saveIndicator.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <svg class="h-5 w-5 text-green-600 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                    <span class="text-green-800 font-medium">分析結果をローカルストレージに保存しました</span>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="text-xs text-green-600">ID: ${analysisId}</span>
                    <button onclick="showAnalysisHistory()" class="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded transition-colors">
                        履歴を見る
                    </button>
                    <button onclick="window.AnalysisStorage.export('${analysisId}')" class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded transition-colors">
                        エクスポート
                    </button>
                </div>
            </div>
        `;
        
        // 分析結果エリアの先頭に挿入
        analysisResults.insertBefore(saveIndicator, analysisResults.firstChild);
        
    } catch (error) {
        console.error('保存インジケーターの追加中にエラーが発生しました:', error);
    }
}

// 分析履歴を表示する
function showAnalysisHistory() {
    try {
        const history = window.AnalysisStorage ? window.AnalysisStorage.getHistory() : [];
        const statistics = window.AnalysisStorage ? window.AnalysisStorage.getStatistics() : null;
        
        // モーダルを作成
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };
        
        const modalContent = document.createElement('div');
        modalContent.className = 'bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden';
        
        modalContent.innerHTML = `
            <div class="p-6 border-b border-gray-200">
                <div class="flex items-center justify-between">
                    <h2 class="text-xl font-semibold">分析履歴</h2>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                        <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                ${statistics ? `
                <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <p class="text-sm text-gray-500">総分析回数</p>
                        <p class="text-xl font-bold text-blue-600">${statistics.total}</p>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <p class="text-sm text-gray-500">平均NDVI</p>
                        <p class="text-xl font-bold text-green-600">${statistics.averageNdvi}</p>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <p class="text-sm text-gray-500">良好な圃場</p>
                        <p class="text-xl font-bold text-green-600">${statistics.healthStatusCounts['良好'] || 0}</p>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <p class="text-sm text-gray-500">要注意圃場</p>
                        <p class="text-xl font-bold text-red-600">${statistics.healthStatusCounts['要注意'] || 0}</p>
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div class="p-6 overflow-y-auto max-h-[60vh]">
                ${history.length === 0 ? `
                    <div class="text-center py-8">
                        <svg class="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <p class="mt-4 text-gray-500">まだ分析履歴がありません</p>
                    </div>
                ` : `
                    <div class="space-y-3">
                        ${history.map(entry => `
                            <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                                <div class="flex items-center justify-between">
                                    <div class="flex-1">
                                        <div class="flex items-center space-x-3">
                                            <h3 class="font-medium text-gray-900">${entry.fieldName}</h3>
                                            <span class="text-xs px-2 py-1 rounded ${getHealthStatusClass(entry.healthStatus)}">${entry.healthStatus}</span>
                                        </div>
                                        <div class="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                                            <span>${entry.date}</span>
                                            <span>NDVI平均: ${entry.ndviAverage}</span>
                                        </div>
                                    </div>
                                    <div class="flex items-center space-x-2">
                                        <button onclick="loadAnalysisResult('${entry.id}')" class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded transition-colors">
                                            詳細を見る
                                        </button>
                                        <button onclick="window.AnalysisStorage.export('${entry.id}')" class="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded transition-colors">
                                            エクスポート
                                        </button>
                                        <button onclick="deleteAnalysisFromHistory('${entry.id}')" class="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded transition-colors">
                                            削除
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
            
            <div class="p-6 border-t border-gray-200">
                <div class="flex justify-between items-center">
                    <button onclick="window.AnalysisStorage.export()" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors">
                        すべてエクスポート
                    </button>
                    <button onclick="confirmClearAllAnalysisResults()" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition-colors">
                        すべて削除
                    </button>
                </div>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
    } catch (error) {
        console.error('分析履歴の表示中にエラーが発生しました:', error);
        if (typeof showToast === 'function') {
            showToast('エラー', '分析履歴の表示に失敗しました');
        }
    }
}

// 健康状態のクラスを取得
function getHealthStatusClass(status) {
    switch (status) {
        case '良好':
            return 'bg-green-100 text-green-800';
        case '普通':
            return 'bg-yellow-100 text-yellow-800';
        case '要注意':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

// 特定の分析結果を読み込む
function loadAnalysisResult(analysisId) {
    try {
        const result = window.AnalysisStorage ? window.AnalysisStorage.getById(analysisId) : null;
        if (!result) {
            if (typeof showToast === 'function') {
                showToast('エラー', '分析結果が見つかりませんでした');
            }
            return;
        }
        
        // モーダルを閉じる
        const modal = document.querySelector('.fixed.inset-0');
        if (modal) {
            modal.remove();
        }
        
        // 分析結果を表示
        displayStoredAnalysisResult(result);
        
    } catch (error) {
        console.error('分析結果の読み込み中にエラーが発生しました:', error);
        if (typeof showToast === 'function') {
            showToast('エラー', '分析結果の読み込みに失敗しました');
        }
    }
}

// 保存された分析結果を表示する
function displayStoredAnalysisResult(result) {
    try {
        console.log('保存された分析結果を表示:', result);
        
        // 保存フラグを設定して新しい保存を防ぐ
        window.isDisplayingStoredResult = true;
        
        // 統計データの構造を確認・修正
        const stats = result.analysis?.stats || {};
        const safeStats = {
            ndvi: {
                mean: stats.ndvi?.mean || '-',
                min: stats.ndvi?.min || '-',
                max: stats.ndvi?.max || '-',
                stdDev: stats.ndvi?.stdDev || '-'
            },
            ndmi: {
                mean: stats.ndmi?.mean || '-',
                min: stats.ndmi?.min || '-',
                max: stats.ndmi?.max || '-',
                stdDev: stats.ndmi?.stdDev || '-'
            },
            ndre: {
                mean: stats.ndre?.mean || '-',
                min: stats.ndre?.min || '-',
                max: stats.ndre?.max || '-',
                stdDev: stats.ndre?.stdDev || '-'
            }
        };
        
        // 植生指標レイヤーの追加
        const data = {
            dateRange: result.analysis.dateRange,
            stats: safeStats,
            ndviTileUrlTemplate: result.analysis.tileUrls?.ndvi,
            ndmiTileUrlTemplate: result.analysis.tileUrls?.ndmi,
            ndreTileUrlTemplate: result.analysis.tileUrls?.ndre
        };
        
        // 各植生指標レイヤーの追加
        addVegetationIndicesLayers(data);
        
        // 健康状態の総合評価
        const evaluation = evaluateFieldHealth(safeStats);
        
        // サマリーの更新
        updateHealthSummary(evaluation, safeStats);
        
        // 詳細統計の更新
        updateDetailedStats(safeStats, result.analysis.dateRange);
        
        // 分析結果パネルの表示
        const analysisResultsEl = document.getElementById('analysisResults');
        if (analysisResultsEl) {
            analysisResultsEl.classList.remove('hidden');
        }
        
        // 生成時刻を更新
        const timeEl = document.getElementById('analysisGeneratedTime');
        if (timeEl) {
            timeEl.textContent = `生成時刻: ${result.dateFormatted}`;
        }
        
        // AIアドバイスがある場合は表示
        if (result.aiAdvice) {
            const aiRecommendations = document.getElementById('aiRecommendations');
            if (aiRecommendations) {
                // 保存されたAIアドバイスを表示
                displaySavedAiAdvice(result.aiAdvice, aiRecommendations);
            }
        } else {
            // AIアドバイスがない場合はデフォルト表示
            const aiRecommendations = document.getElementById('aiRecommendations');
            if (aiRecommendations) {
                aiRecommendations.innerHTML = `
                    <div class="text-center py-4 text-gray-500">
                        <i class="fas fa-info-circle mr-2"></i>
                        この分析結果にはAIアドバイスが含まれていません
                    </div>
                `;
            }
        }
        
        // 保存された結果であることを示すインジケーターを追加
        const saveIndicator = document.createElement('div');
        saveIndicator.className = 'save-indicator bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4';
        saveIndicator.innerHTML = `
            <div class="flex items-center">
                <svg class="h-5 w-5 text-blue-600 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h12v8H4V6z" clip-rule="evenodd" />
                </svg>
                <span class="text-blue-800 font-medium">保存された分析結果を表示中</span>
                <span class="ml-2 text-xs text-blue-600">ID: ${result.id}</span>
                <span class="ml-2 text-xs text-blue-600">保存日時: ${result.dateFormatted}</span>
            </div>
        `;
        
        const analysisResults = document.getElementById('analysisResults');
        if (analysisResults) {
            analysisResults.insertBefore(saveIndicator, analysisResults.firstChild);
        }
        
        if (typeof showToast === 'function') {
            showToast('読み込み完了', `分析結果を読み込みました (${result.field.name})`);
        }
        
        // 保存フラグをリセット
        setTimeout(() => {
            window.isDisplayingStoredResult = false;
        }, 1000);
        
    } catch (error) {
        console.error('保存された分析結果の表示中にエラーが発生しました:', error);
        if (typeof showToast === 'function') {
            showToast('エラー', '分析結果の表示に失敗しました');
        }
        // エラー時もフラグをリセット
        window.isDisplayingStoredResult = false;
    }
}

// 保存されたAIアドバイスを表示する関数
function displaySavedAiAdvice(aiAdvice, container) {
    try {
        if (!aiAdvice || typeof aiAdvice !== 'object') {
            container.innerHTML = `
                <div class="text-center py-4 text-gray-500">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    AIアドバイスの形式が正しくありません
                </div>
            `;
            return;
        }
        
        let adviceContent = `
            <div class="mb-4">
                <h3 class="text-lg font-semibold mb-1 text-center bg-green-100 py-2 rounded-t-lg border-b border-green-200">
                    圃場の健康状態と対策 (保存済み)
                </h3>
            </div>
        `;
        
        // 重要な知見のまとめ
        if (aiAdvice.重要な知見のまとめ) {
            adviceContent += `
                <div class="mb-4 p-4 bg-green-50 rounded-lg border border-green-100">
                    <div class="flex items-start">
                        <div class="mr-2">
                            <span class="inline-block bg-green-100 p-2 rounded-full">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                                </svg>
                            </span>
                        </div>
                        <div>
                            <h4 class="font-semibold text-green-800 mb-1">重要な知見のまとめ</h4>
                            <p class="text-sm text-gray-700">${aiAdvice.重要な知見のまとめ}</p>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 具体的な対策
        if (aiAdvice.具体的な対策 && Array.isArray(aiAdvice.具体的な対策)) {
            adviceContent += `
                <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div class="flex items-center mb-2">
                        <span class="inline-block text-blue-600 mr-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </span>
                        <h4 class="font-semibold text-blue-800">具体的な対策</h4>
                    </div>
                    <ul class="list-none pl-8">
                        ${aiAdvice.具体的な対策.map(item => `
                            <li class="mb-2 flex items-start">
                                <span class="inline-block text-blue-600 mr-2 mt-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </span>
                                <span class="text-gray-700 text-sm">${item}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        }
        
        container.innerHTML = adviceContent;
        
    } catch (error) {
        console.error('保存されたAIアドバイスの表示エラー:', error);
        container.innerHTML = `
            <div class="text-center py-4 text-red-500">
                <i class="fas fa-exclamation-triangle mr-2"></i>
                AIアドバイスの表示中にエラーが発生しました
            </div>
        `;
    }
}

// 履歴から分析結果を削除
function deleteAnalysisFromHistory(analysisId) {
    if (confirm('この分析結果を削除しますか？')) {
        if (window.AnalysisStorage && window.AnalysisStorage.delete(analysisId)) {
            showAnalysisHistory(); // 履歴を再表示
            if (typeof showToast === 'function') {
                showToast('削除完了', '分析結果を削除しました');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('エラー', '分析結果の削除に失敗しました');
            }
        }
    }
}

// すべての分析結果削除の確認
function confirmClearAllAnalysisResults() {
    if (confirm('すべての分析結果を削除しますか？この操作は取り消せません。')) {
        if (window.AnalysisStorage && window.AnalysisStorage.clear()) {
            const modal = document.querySelector('.fixed.inset-0');
            if (modal) {
                modal.remove();
            }
            
            // AI アシスタントの選択もすべてクリア
            if (window.AiAssistantHistory) {
                window.AiAssistantHistory.clearSelections();
            }
            
            // 履歴セクションを更新
            updateAnalysisHistorySection();
            
            if (typeof showToast === 'function') {
                showToast('削除完了', 'すべての分析結果を削除しました');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('エラー', '分析結果の削除に失敗しました');
            }
        }
    }
}

// 分析履歴セクションを更新する
function updateAnalysisHistorySection() {
    try {
        const historySection = document.getElementById('analysisHistorySection');
        const historyList = document.getElementById('historyList');
        const historyStatistics = document.getElementById('historyStatistics');
        const historyEmptyState = document.getElementById('historyEmptyState');
        
        if (!historySection || !historyList || !historyStatistics || !historyEmptyState) {
            return;
        }
        
        const history = window.AnalysisStorage ? window.AnalysisStorage.getHistory() : [];
        const statistics = window.AnalysisStorage ? window.AnalysisStorage.getStatistics() : null;
        
        // 統計情報を更新
        if (statistics && statistics.total > 0) {
            historyStatistics.innerHTML = `
                <div class="bg-blue-50 p-3 rounded-lg">
                    <p class="text-sm text-blue-600 mb-1">総分析回数</p>
                    <p class="text-xl font-bold text-blue-800">${statistics.total}</p>
                </div>
                <div class="bg-green-50 p-3 rounded-lg">
                    <p class="text-sm text-green-600 mb-1">平均NDVI</p>
                    <p class="text-xl font-bold text-green-800">${statistics.averageNdvi}</p>
                </div>
                <div class="bg-yellow-50 p-3 rounded-lg">
                    <p class="text-sm text-yellow-600 mb-1">良好な圃場</p>
                    <p class="text-xl font-bold text-yellow-800">${statistics.healthStatusCounts['良好'] || 0}</p>
                </div>
                <div class="bg-red-50 p-3 rounded-lg">
                    <p class="text-sm text-red-600 mb-1">要注意圃場</p>
                    <p class="text-xl font-bold text-red-800">${statistics.healthStatusCounts['要注意'] || 0}</p>
                </div>
            `;
        } else {
            historyStatistics.innerHTML = '';
        }
        
        // 履歴リストを更新
        if (history.length === 0) {
            historyList.innerHTML = '';
            historyEmptyState.classList.remove('hidden');
        } else {
            historyEmptyState.classList.add('hidden');
            
            // 最新の5件のみ表示（パフォーマンス向上のため）
            const recentHistory = history.slice(0, 5);
            
            historyList.innerHTML = recentHistory.map(entry => `
                <div class="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                    <div class="flex items-center justify-between">
                        <div class="flex-1">
                            <div class="flex items-center space-x-3">
                                <h4 class="font-medium text-gray-900 text-sm">${entry.fieldName}</h4>
                                <span class="text-xs px-2 py-1 rounded ${getHealthStatusClass(entry.healthStatus)}">${entry.healthStatus}</span>
                            </div>
                            <div class="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                                <span><i class="fas fa-calendar-alt mr-1"></i>${entry.date}</span>
                                <span><i class="fas fa-leaf mr-1"></i>NDVI: ${entry.ndviAverage}</span>
                            </div>
                        </div>
                        <div class="flex items-center space-x-1">
                            <button onclick="loadAnalysisResultFromHistory('${entry.id}')" class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-2 py-1 rounded transition-colors" title="詳細を表示">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button onclick="window.AnalysisStorage.export('${entry.id}')" class="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-2 py-1 rounded transition-colors" title="エクスポート">
                                <i class="fas fa-download"></i>
                            </button>
                            <button onclick="deleteAnalysisFromHistorySection('${entry.id}')" class="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-2 py-1 rounded transition-colors" title="削除">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
            
            // より多くの履歴がある場合は「もっと見る」ボタンを追加
            if (history.length > 5) {
                historyList.innerHTML += `
                    <div class="text-center py-3">
                        <button onclick="showAnalysisHistory()" class="text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded transition-colors">
                            <i class="fas fa-plus mr-1"></i>さらに表示 (${history.length - 5}件)
                        </button>
                    </div>
                `;
            }
        }
        
    } catch (error) {
        console.error('分析履歴セクションの更新中にエラーが発生しました:', error);
    }
}

// 履歴セクションから分析結果を読み込む
function loadAnalysisResultFromHistory(analysisId) {
    try {
        const result = window.AnalysisStorage ? window.AnalysisStorage.getById(analysisId) : null;
        if (!result) {
            if (typeof showToast === 'function') {
                showToast('エラー', '分析結果が見つかりませんでした');
            }
            return;
        }
        
        // 分析結果を表示
        displayStoredAnalysisResult(result);
        
        // 分析結果セクションにスクロール
        const analysisResults = document.getElementById('analysisResults');
        if (analysisResults) {
            analysisResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
    } catch (error) {
        console.error('分析結果の読み込み中にエラーが発生しました:', error);
        if (typeof showToast === 'function') {
            showToast('エラー', '分析結果の読み込みに失敗しました');
        }
    }
}

// 履歴セクションから分析結果を削除
function deleteAnalysisFromHistorySection(analysisId) {
    if (confirm('この分析結果を削除しますか？')) {
        if (window.AnalysisStorage && window.AnalysisStorage.delete(analysisId)) {
            updateAnalysisHistorySection(); // 履歴セクションを再表示
            
            // AI アシスタントの選択からも削除
            if (window.AiAssistantHistory) {
                window.AiAssistantHistory.removeSelection(analysisId);
                window.AiAssistantHistory.update();
            }
            
            if (typeof showToast === 'function') {
                showToast('削除完了', '分析結果を削除しました');
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('エラー', '分析結果の削除に失敗しました');
            }
        }
    }
}

// 分析履歴を更新する
function refreshAnalysisHistory() {
    updateAnalysisHistorySection();
    if (typeof showToast === 'function') {
        showToast('更新完了', '分析履歴を更新しました');
    }
}

// 総合的な圃場健康状態の評価
function evaluateFieldHealth(stats) {
    // NDVIの評価
    const ndviStatus = evaluateNdviStatus(stats.ndvi.mean);
    
    // NDMIの評価
    const ndmiStatus = evaluateNdmiStatus(stats.ndmi.mean);
    
    // NDREの評価
    const ndreStatus = evaluateNdreStatus(stats.ndre.mean);
    
    // 総合評価
    let overallStatus = { status: '不明', class: 'bg-gray-100 text-gray-800' };
    
    // 全てのデータが有効な場合のみ総合評価
    if (ndviStatus.status !== '不明' && ndmiStatus.status !== '不明' && ndreStatus.status !== '不明') {
        const statusValues = [
            getStatusValue(ndviStatus.status),
            getStatusValue(ndmiStatus.status),
            getStatusValue(ndreStatus.status)
        ];
        
        const avgStatus = statusValues.reduce((sum, val) => sum + val, 0) / statusValues.length;
        
        if (avgStatus >= 2.5) {
            overallStatus = { status: '良好', class: 'bg-green-100 text-green-800' };
        } else if (avgStatus >= 1.5) {
            overallStatus = { status: '普通', class: 'bg-yellow-100 text-yellow-800' };
        } else {
            overallStatus = { status: '要注意', class: 'bg-red-100 text-red-800' };
        }
    }
    
    return {
        overall: overallStatus,
        ndvi: ndviStatus,
        ndmi: ndmiStatus,
        ndre: ndreStatus
    };
}

// ステータスの数値化
function getStatusValue(status) {
    switch (status) {
        case '良好': return 3;
        case '普通': return 2;
        case '要注意': return 1;
        default: return 0;
    }
}

// NDVI値の評価
function evaluateNdviStatus(avgNdvi) {
    if (avgNdvi === '-') return { status: '不明', class: 'bg-gray-100 text-gray-800' };
    
    const avgVal = parseFloat(avgNdvi);
    if (avgVal > CONFIG.NDVI.GOOD) {
        return { status: '良好', class: 'bg-green-100 text-green-800' };
    } else if (avgVal > CONFIG.NDVI.MODERATE) {
        return { status: '普通', class: 'bg-yellow-100 text-yellow-800' };
    } else {
        return { status: '要注意', class: 'bg-red-100 text-red-800' };
    }
}

// NDMI値の評価
function evaluateNdmiStatus(avgNdmi) {
    if (avgNdmi === '-') return { status: '不明', class: 'bg-gray-100 text-gray-800' };
    
    const avgVal = parseFloat(avgNdmi);
    if (avgVal > CONFIG.NDMI.GOOD) {
        return { status: '良好', class: 'bg-green-100 text-green-800' };
    } else if (avgVal > CONFIG.NDMI.MODERATE) {
        return { status: '普通', class: 'bg-yellow-100 text-yellow-800' };
    } else {
        return { status: '要注意', class: 'bg-red-100 text-red-800' };
    }
}

// NDRE値の評価
function evaluateNdreStatus(avgNdre) {
    if (avgNdre === '-') return { status: '不明', class: 'bg-gray-100 text-gray-800' };
    
    const avgVal = parseFloat(avgNdre);
    if (avgVal > CONFIG.NDRE.GOOD) {
        return { status: '良好', class: 'bg-green-100 text-green-800' };
    } else if (avgVal > CONFIG.NDRE.MODERATE) {
        return { status: '普通', class: 'bg-yellow-100 text-yellow-800' };
    } else {
        return { status: '要注意', class: 'bg-red-100 text-red-800' };
    }
}

// 健康サマリーの更新
function updateHealthSummary(evaluation, stats) {
    // 数値を小数点第3位まで四捨五入するヘルパー関数
    const formatNumber = (value) => {
        if (typeof value === 'string' && value === '-') return '-';
        const num = parseFloat(value);
        const config = window.ModuleManager?.get('config') || window.CONFIG;
        const places = config?.UI?.DEFAULT_DECIMAL_PLACES || 3;
        return isNaN(num) ? '-' : num.toFixed(places);
    };
    
    updateOrCreateElement('avgNdviValue', formatNumber(stats.ndvi.mean));
    updateOrCreateElement('healthStatusBadge', evaluation.overall.status, evaluation.overall.class);
}

// 要素の更新または作成を行う補助関数
function updateOrCreateElement(id, value) {
    let element = document.getElementById(id);
    const parentElement = document.getElementById('healthSummary');
    
    if (!element && parentElement) {
        const label = id.includes('Ndmi') ? '水分指標 (NDMI):' : '栽養指標 (NDRE):';
        const newElement = document.createElement('div');
        newElement.className = 'flex justify-between items-center mb-1';
        newElement.innerHTML = `
            <span class="text-sm text-gray-600">${label}</span>
            <span id="${id}" class="font-semibold">${value}</span>
        `;
        parentElement.appendChild(newElement);
    } else if (element) {
        element.textContent = value;
    }
}

// AIコメントの更新（シンプルなベースライン）
function updateAiComment(evaluation, stats) {
    const aiCommentEl = document.getElementById('aiRecommendations');
    if (!aiCommentEl) return;
    
    // AIコメント要素に既にGemini API用のローディング表示がある場合はスキップ
    if (aiCommentEl.innerHTML.includes('AIアドバイスを生成中')) {
        console.log('AIコメント更新をスキップ: Gemini API処理中');
        return;
    }

    // AIコメント要素に既に詳細なアドバイスが含まれている場合はスキップ
    if (aiCommentEl.innerHTML.includes('健康状態の総合評価') || 
        aiCommentEl.innerHTML.includes('各指標の詳細評価') ||
        aiCommentEl.innerHTML.includes('重要な知見のまとめ')) {
        console.log('AIコメント更新をスキップ: 既に詳細アドバイスあり');
        return;
    }
    
    // シンプルな評価コメントを表示（APIからの詳細結果が来るまでの間表示）
    let comment = `
    <div class="flex flex-col items-center justify-center py-6 bg-white rounded-lg">
        <div class="mb-4">
            <div class="animate-spin inline-block h-10 w-10 border-b-2 border-blue-500 rounded-full"></div>
        </div>
        <p class="text-gray-700 text-lg font-medium">より詳細なAIアドバイスを生成中です...</p>
        <p class="text-gray-500 mt-2">分析データをもとに、作物の健康状態を評価しています</p>
    </div>`;
    
    aiCommentEl.innerHTML = comment;
}

// 詳細統計の更新
function updateDetailedStats(stats, dateRange) {
    // 表の内容を更新するために既存のテーブルボディをクリア
    const tableBody = document.getElementById('statsTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // NDVI行の追加
    addStatRow(tableBody, 'NDVI', '植生指標', stats.ndvi, dateRange);
    
    // NDMI行の追加
    addStatRow(tableBody, 'NDMI', '水分指標', stats.ndmi);
    
    // NDRE行の追加
    addStatRow(tableBody, 'NDRE', '栽養指標', stats.ndre);
}

// 統計行の追加
function addStatRow(tableBody, indexName, description, statData, dateRange) {
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-200';
    
    // 数値を小数点第3位まで四捨五入するヘルパー関数
    const formatNumber = (value) => {
        if (typeof value === 'string' && value === '-') return '-';
        const num = parseFloat(value);
        const config = window.ModuleManager?.get('config') || window.CONFIG;
        const places = config?.UI?.DEFAULT_DECIMAL_PLACES || 3;
        return isNaN(num) ? '-' : num.toFixed(places);
    };
    
    const descCell = document.createElement('td');
    descCell.className = 'py-2 px-4';
    descCell.innerHTML = `<span class="font-semibold">${indexName}</span><br><span class="text-xs text-gray-500">${description}</span>`;
    
    const avgCell = document.createElement('td');
    avgCell.className = 'py-2 px-4';
    avgCell.innerHTML = `${formatNumber(statData.mean)}<br><span class="text-xs ${getStatusClass(statData.mean, indexName)}">${getStatusText(statData.mean, false, indexName)}</span>`;
    
    const minCell = document.createElement('td');
    minCell.className = 'py-2 px-4';
    minCell.innerHTML = `${formatNumber(statData.min)}<br><span class="text-xs ${getStatusClass(statData.min, indexName, true)}">${getStatusText(statData.min, true, indexName)}</span>`;
    
    const maxCell = document.createElement('td');
    maxCell.className = 'py-2 px-4';
    maxCell.innerHTML = `${formatNumber(statData.max)}<br><span class="text-xs ${getStatusClass(statData.max, indexName)}">${getStatusText(statData.max, false, indexName)}</span>`;
    
    const stdDevCell = document.createElement('td');
    stdDevCell.className = 'py-2 px-4';
    stdDevCell.innerHTML = `${formatNumber(statData.stdDev)}<br><span class="text-xs ${getStdDevStatusClass(statData.stdDev)}">${getStdDevStatusText(statData.stdDev)}</span>`;
    
    row.appendChild(descCell);
    row.appendChild(avgCell);
    row.appendChild(minCell);
    row.appendChild(maxCell);
    row.appendChild(stdDevCell);
    
    // 日付範囲は最初の行のみに表示
    if (dateRange) {
        const dateCell = document.createElement('td');
        dateCell.className = 'py-2 px-4 align-middle';
        dateCell.setAttribute('rowspan', '3');  // 3行分結合
        const dateRangeText = dateRange ? `${dateRange.start} 〜 ${dateRange.end}` : '-';
        dateCell.textContent = dateRangeText;
        row.appendChild(dateCell);
    }
    
    tableBody.appendChild(row);
}

// 指標ごとのステータスクラスを取得
function getStatusClass(value, indexType, isMin = false) {
    const val = parseFloat(value);
    if (isNaN(val)) return 'text-gray-500';
    
    let thresholds;
    switch(indexType) {
        case 'NDVI':
            thresholds = isMin ? 
                { good: CONFIG.NDVI.MIN_GOOD, moderate: CONFIG.NDVI.MIN_MODERATE } : 
                { good: CONFIG.NDVI.GOOD, moderate: CONFIG.NDVI.MODERATE };
            break;
        case 'NDMI':
            thresholds = isMin ? 
                { good: CONFIG.NDMI.MIN_GOOD, moderate: CONFIG.NDMI.MIN_MODERATE } : 
                { good: CONFIG.NDMI.GOOD, moderate: CONFIG.NDMI.MODERATE };
            break;
        case 'NDRE':
            thresholds = isMin ? 
                { good: CONFIG.NDRE.MIN_GOOD, moderate: CONFIG.NDRE.MIN_MODERATE } : 
                { good: CONFIG.NDRE.GOOD, moderate: CONFIG.NDRE.MODERATE };
            break;
        default:
            thresholds = isMin ? 
                { good: CONFIG.NDVI.MIN_GOOD, moderate: CONFIG.NDVI.MIN_MODERATE } : 
                { good: CONFIG.NDVI.GOOD, moderate: CONFIG.NDVI.MODERATE };
    }
    
    if (val >= thresholds.good) return 'text-green-600';
    if (val >= thresholds.moderate) return 'text-yellow-600';
    return 'text-red-600';
}

// 指標値の評価テキスト生成
function getStatusText(value, isMin = false, indexType = 'NDVI') {
    const val = parseFloat(value);
    if (isNaN(val)) return '-';
    
    let thresholds;
    switch(indexType) {
        case 'NDVI':
            thresholds = isMin ? 
                { good: CONFIG.NDVI.MIN_GOOD, moderate: CONFIG.NDVI.MIN_MODERATE } : 
                { good: CONFIG.NDVI.GOOD, moderate: CONFIG.NDVI.MODERATE };
            break;
        case 'NDMI':
            thresholds = isMin ? 
                { good: CONFIG.NDMI.MIN_GOOD, moderate: CONFIG.NDMI.MIN_MODERATE } : 
                { good: CONFIG.NDMI.GOOD, moderate: CONFIG.NDMI.MODERATE };
            break;
        case 'NDRE':
            thresholds = isMin ? 
                { good: CONFIG.NDRE.MIN_GOOD, moderate: CONFIG.NDRE.MIN_MODERATE } : 
                { good: CONFIG.NDRE.GOOD, moderate: CONFIG.NDRE.MODERATE };
            break;
        default:
            thresholds = isMin ? 
        { good: CONFIG.NDVI.MIN_GOOD, moderate: CONFIG.NDVI.MIN_MODERATE } : 
        { good: CONFIG.NDVI.GOOD, moderate: CONFIG.NDVI.MODERATE };
    }
    
    if (val >= thresholds.good) return '良好 (Good)';
    if (val >= thresholds.moderate) return '普通 (Moderate)';
    return '要注意 (Low)';
}

// 標準偏差の評価テキスト生成
function getStdDevStatusText(value) {
    const val = parseFloat(value);
    if (isNaN(val)) return '-';
    
    if (val < CONFIG.STD_DEV.LOW) return '低い (Low Variability)';
    if (val < CONFIG.STD_DEV.MODERATE) return '中程度 (Moderate Variability)';
    return '高い (High Variability)';
}

// 標準偏差の評価クラスを生成
function getStdDevStatusClass(value) {
    const val = parseFloat(value);
    if (isNaN(val)) return 'text-gray-500';
    
    if (val < CONFIG.STD_DEV.LOW) return 'text-green-600';
    if (val < CONFIG.STD_DEV.MODERATE) return 'text-yellow-600';
    return 'text-red-600';
}

// 複数の植生指標レイヤーを追加
function addVegetationIndicesLayers(data) {
    // レイヤーを追加する前に既存のレイヤーをクリア
    clearVegetationLayers();
    
    // NDVIレイヤーがある場合
    if (data.ndviTileUrlTemplate) {
        addNdviLayer(data.ndviTileUrlTemplate, data.dateRange);
    }
    
    // NDMIレイヤーがある場合
    if (data.ndmiTileUrlTemplate) {
        addNdmiLayer(data.ndmiTileUrlTemplate, data.dateRange);
    }
    
    // NDREレイヤーがある場合
    if (data.ndreTileUrlTemplate) {
        addNdreLayer(data.ndreTileUrlTemplate, data.dateRange);
    }
    
    // レイヤー切り替えボタンの初期状態を設定
    updateLayerToggleButtons();
}

// NDMI（水分ストレス指標）レイヤーを追加
function addNdmiLayer(tileUrlTemplate, dateRange) {
    if (!tileUrlTemplate) return;
    
    const dateText = dateRange ? `(${dateRange.start} - ${dateRange.end})` : '';
    const ndmiLayer = L.tileLayer(tileUrlTemplate, {
        opacity: 0.7,
        attribution: `NDMI ${dateText} © Google Earth Engine`
    });
    
    // レイヤーをマップに追加し、レイヤーコントロールに登録
    vegetationLayers.ndmi = ndmiLayer;
    layerControl.addOverlay(ndmiLayer, `NDMI（水分指標） ${dateText}`);
}

// NDRE（栽養状態指標）レイヤーを追加
function addNdreLayer(tileUrlTemplate, dateRange) {
    if (!tileUrlTemplate) return;
    
    const dateText = dateRange ? `(${dateRange.start} - ${dateRange.end})` : '';
    const ndreLayer = L.tileLayer(tileUrlTemplate, {
        opacity: 0.7,
        attribution: `NDRE ${dateText} © Google Earth Engine`
    });
    
    // レイヤーをマップに追加し、レイヤーコントロールに登録
    vegetationLayers.ndre = ndreLayer;
    layerControl.addOverlay(ndreLayer, `NDRE（栽養指標） ${dateText}`);
}

// レイヤー切り替えボタンの状態を更新
function updateLayerToggleButtons() {
    const ndviBtn = document.getElementById('toggleNdviBtn');
    const ndmiBtn = document.getElementById('toggleNdmiBtn');
    const ndreBtn = document.getElementById('toggleNdreBtn');
    
    // 各ボタンのクラスをリセット
    if (ndviBtn) ndviBtn.className = 'px-3 py-2 text-xs rounded-l-md bg-gray-200 hover:bg-blue-500 hover:text-white';
    if (ndmiBtn) ndmiBtn.className = 'px-3 py-2 text-xs bg-gray-200 hover:bg-blue-500 hover:text-white';
    if (ndreBtn) ndreBtn.className = 'px-3 py-2 text-xs rounded-r-md bg-gray-200 hover:bg-blue-500 hover:text-white';
    
    // 有効なレイヤーに対応するボタンをアクティブにする
    if (vegetationLayers.ndvi) {
        if (ndviBtn) ndviBtn.className = 'px-3 py-2 text-xs rounded-l-md bg-blue-500 text-white hover:bg-blue-600';
    }
    
    if (vegetationLayers.ndmi) {
        if (ndmiBtn) ndmiBtn.className = 'px-3 py-2 text-xs bg-blue-500 text-white hover:bg-blue-600';
    }
    
    if (vegetationLayers.ndre) {
        if (ndreBtn) ndreBtn.className = 'px-3 py-2 text-xs rounded-r-md bg-blue-500 text-white hover:bg-blue-600';
    }
}