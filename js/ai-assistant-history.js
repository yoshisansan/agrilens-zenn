/**
 * AI アシスタント用の分析履歴選択機能
 */

// 選択された分析データのIDを保持
let selectedAnalysisIds = new Set();

/**
 * AI アシスタント用の履歴選択セクションを初期化・更新
 */
function updateAiAssistantHistorySelection() {
    try {
        const checkboxContainer = document.getElementById('aiHistoryCheckboxes');
        const emptyState = document.getElementById('aiHistoryEmpty');
        
        if (!checkboxContainer || !emptyState) {
            return;
        }
        
        const history = window.AnalysisStorage ? window.AnalysisStorage.getHistory() : [];
        
        if (history.length === 0) {
            checkboxContainer.innerHTML = '';
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            
            // 最新5件のみ表示
            const recentHistory = history.slice(0, 5);
            
            checkboxContainer.innerHTML = recentHistory.map(entry => `
                <div class="flex items-center p-2 bg-white rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                    <input 
                        type="checkbox" 
                        id="analysis_${entry.id}" 
                        class="mr-2 rounded border-gray-300 text-green-600 focus:ring-green-500"
                        onchange="toggleAnalysisSelection('${entry.id}')"
                        ${selectedAnalysisIds.has(entry.id) ? 'checked' : ''}
                    >
                    <label for="analysis_${entry.id}" class="flex-1 cursor-pointer">
                        <div class="flex items-center justify-between">
                            <div class="flex-1">
                                <div class="text-sm font-medium text-gray-900 truncate" title="${entry.fieldName}">
                                    ${entry.fieldName}
                                </div>
                                <div class="text-xs text-gray-500 flex items-center space-x-2">
                                    <span><i class="fas fa-calendar-alt mr-1"></i>${entry.date.split(' ')[0]}</span>
                                    <span class="px-1 py-0.5 rounded text-xs ${getHealthStatusClass(entry.healthStatus)}">${entry.healthStatus}</span>
                                </div>
                            </div>
                        </div>
                    </label>
                </div>
            `).join('');
        }
        
        updateSelectedAnalysisCount();
        
    } catch (error) {
        console.error('AI アシスタント履歴選択の更新中にエラーが発生しました:', error);
    }
}

/**
 * 分析データの選択状態を切り替え
 * @param {string} analysisId - 分析ID
 */
function toggleAnalysisSelection(analysisId) {
    if (selectedAnalysisIds.has(analysisId)) {
        selectedAnalysisIds.delete(analysisId);
    } else {
        selectedAnalysisIds.add(analysisId);
    }
    
    updateSelectedAnalysisCount();
    console.log('選択された分析ID:', Array.from(selectedAnalysisIds));
}

/**
 * 選択された分析件数を更新
 */
function updateSelectedAnalysisCount() {
    const countElement = document.getElementById('selectedAnalysisCount');
    if (countElement) {
        countElement.textContent = selectedAnalysisIds.size;
    }
}

/**
 * AI アシスタント履歴を手動更新
 */
function refreshAiAssistantHistory() {
    updateAiAssistantHistorySelection();
    if (typeof showToast === 'function') {
        showToast('更新完了', 'AI アシスタント用履歴を更新しました');
    }
}

/**
 * 選択された分析データを取得してAI質問用のコンテキストを作成
 * @returns {string} AI質問用のコンテキスト文字列
 */
function getSelectedAnalysisContext() {
    try {
        if (selectedAnalysisIds.size === 0) {
            return '';
        }
        
        const selectedData = [];
        
        for (const analysisId of selectedAnalysisIds) {
            const result = window.AnalysisStorage ? window.AnalysisStorage.getById(analysisId) : null;
            if (result) {
                // 分析結果をAI用に要約
                const summary = {
                    圃場名: result.field.name,
                    分析日時: result.dateFormatted,
                    位置: {
                        緯度: result.field.location.latitude,
                        経度: result.field.location.longitude,
                        地域: result.field.region
                    },
                    作物: result.field.crop,
                    面積: result.field.area,
                    健康状態: result.evaluation.overall.status,
                    植生指標: {
                        NDVI: {
                            平均: result.analysis.stats.ndvi.mean,
                            最小: result.analysis.stats.ndvi.min,
                            最大: result.analysis.stats.ndvi.max,
                            標準偏差: result.analysis.stats.ndvi.stdDev,
                            評価: result.evaluation.ndvi.status
                        },
                        NDMI: {
                            平均: result.analysis.stats.ndmi.mean,
                            最小: result.analysis.stats.ndmi.min,
                            最大: result.analysis.stats.ndmi.max,
                            標準偏差: result.analysis.stats.ndmi.stdDev,
                            評価: result.evaluation.ndmi.status
                        },
                        NDRE: {
                            平均: result.analysis.stats.ndre.mean,
                            最小: result.analysis.stats.ndre.min,
                            最大: result.analysis.stats.ndre.max,
                            標準偏差: result.analysis.stats.ndre.stdDev,
                            評価: result.evaluation.ndre.status
                        }
                    },
                    分析期間: result.analysis.dateRange
                };
                
                // AIアドバイスがあれば追加
                if (result.aiAdvice) {
                    summary.AIアドバイス = result.aiAdvice;
                }
                
                selectedData.push(summary);
            }
        }
        
        if (selectedData.length === 0) {
            return '';
        }
        
        return `
参照データとして以下の${selectedData.length}件の分析結果を使用してください：

${selectedData.map((data, index) => `
【分析データ ${index + 1}】
圃場名: ${data.圃場名}
分析日時: ${data.分析日時}
作物: ${data.作物}
面積: ${data.面積}ヘクタール
健康状態: ${data.健康状態}
位置: 緯度${data.位置.緯度}、経度${data.位置.経度}（${data.位置.地域}）
植生指標:
  - NDVI（植生指標）: 平均${data.植生指標.NDVI.平均}、最小${data.植生指標.NDVI.最小}、最大${data.植生指標.NDVI.最大}、標準偏差${data.植生指標.NDVI.標準偏差} → ${data.植生指標.NDVI.評価}
  - NDMI（水分指標）: 平均${data.植生指標.NDMI.平均}、最小${data.植生指標.NDMI.最小}、最大${data.植生指標.NDMI.最大}、標準偏差${data.植生指標.NDMI.標準偏差} → ${data.植生指標.NDMI.評価}
  - NDRE（栄養指標）: 平均${data.植生指標.NDRE.平均}、最小${data.植生指標.NDRE.最小}、最大${data.植生指標.NDRE.最大}、標準偏差${data.植生指標.NDRE.標準偏差} → ${data.植生指標.NDRE.評価}
分析期間: ${data.分析期間.start}から${data.分析期間.end}
${data.AIアドバイス ? `過去のAIアドバイス: ${data.AIアドバイス['重要な知見のまとめ'] || '記録なし'}` : ''}
`).join('\n')}

上記のデータを参考にして、以下の質問に回答してください。
`;
        
    } catch (error) {
        console.error('選択された分析コンテキストの作成中にエラーが発生しました:', error);
        return '';
    }
}

/**
 * AI質問送信時に選択されたデータを含むプロンプトを作成
 * @param {string} userQuestion - ユーザーの質問
 * @returns {string} 完全なプロンプト
 */
function createAiPromptWithContext(userQuestion) {
    const context = getSelectedAnalysisContext();
    
    if (context) {
        return context + '\n\n質問: ' + userQuestion;
    } else {
        return userQuestion;
    }
}

/**
 * すべての選択を解除
 */
function clearAllSelections() {
    selectedAnalysisIds.clear();
    updateAiAssistantHistorySelection();
}

/**
 * 特定の分析IDの選択を解除（分析が削除された場合など）
 * @param {string} analysisId - 削除された分析ID
 */
function removeAnalysisFromSelection(analysisId) {
    selectedAnalysisIds.delete(analysisId);
    updateSelectedAnalysisCount();
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    // 少し遅延させてから初期化（他のモジュールの読み込み完了を待つ）
    setTimeout(() => {
        updateAiAssistantHistorySelection();
    }, 1000);
});

// グローバルに公開する関数（ファイル末尾に追加）
if (typeof window !== 'undefined') {
    window.AiAssistantHistory = {
        update: updateAiAssistantHistorySelection,
        refresh: refreshAiAssistantHistory,
        createPrompt: createAiPromptWithContext,
        getSelectedIds: function() {
            return Array.from(selectedAnalysisIds);
        },
        getSelectedContext: getSelectedAnalysisContext,
        clearSelections: clearAllSelections,
        removeSelection: removeAnalysisFromSelection,
        toggleSelection: toggleAnalysisSelection
    };
    
    // 個別の関数も公開（後方互換性のため）
    window.updateAiAssistantHistorySelection = updateAiAssistantHistorySelection;
    window.refreshAiAssistantHistory = refreshAiAssistantHistory;
    window.toggleAnalysisSelection = toggleAnalysisSelection;
}

console.log('AI Assistant History module loaded successfully');