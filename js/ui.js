// 初期化処理
function initializeUI() {
    // 認証状態を確認
    checkAuthStatus();
    
    // マップの初期化
    initializeMap();
    
    // モーダルのイベントリスナー設定
    setupModalEventListeners();
    
    // サイドバーのイベントリスナー設定（存在する場合）
    if (typeof setupSidebarEventListeners === 'function') {
        setupSidebarEventListeners();
    }
    
    // 描画案内モーダルのイベントリスナー設定
    setupDrawingHelpModalEventListeners();
    
    // タブ切り替え機能の初期設定
    setupTabsEventListeners();
    
    // 分析ボタンのイベントリスナー
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', async () => {
            console.log('分析ボタンがクリックされました');
            
            if (!currentAOIGeoJSON) {
                showCompletionModal("エラー", "分析する範囲が選択されていません。マップ上で範囲を選択してください。");
                return;
            }
            
            try {
                console.log('分析リクエスト送信: ', currentAOIGeoJSON);
                const data = await fetchGEEAnalysis(currentAOIGeoJSON);
                console.log('分析結果受信: ', data);
                displayAnalysisResults(data);
                
                // 現在選択中の区画に分析結果を保存
                if (currentFieldId && typeof saveFieldAnalysis === 'function') {
                    saveFieldAnalysis(currentFieldId, {
                        dateRange: data.dateRange,
                        stats: data.stats,
                        tileUrlTemplate: data.tileUrlTemplate
                    });
                    console.log('区画分析結果を保存しました:', currentFieldId);
                    
                    // 区画リストを更新して分析結果を反映
                    if (typeof renderFieldsList === 'function') {
                        renderFieldsList();
                    }
                }
            } catch (error) {
                console.error("分析エラー:", error);
                // エラーの場合も処理中モーダルが表示されている可能性があるため、明示的に閉じる
                if (typeof hideProcessingModal === 'function') {
                    hideProcessingModal();
                }
                
                // エラーをユーザーに表示
                showToast("分析エラー", `分析処理中にエラーが発生しました: ${error.message}`);
            }
        });
    }
    
    // マップ初期化イベントのリスナー
    window.addEventListener('mapInitialized', () => {
        console.log('マップが初期化されました');
    });
    
    // 分析完了イベントのリスナー
    document.addEventListener('analysisCompleted', (e) => {
        console.log('分析が完了しました:', e.detail);
    });
    
    // 描画削除ボタンのイベントリスナー
    const clearDrawingBtn = document.getElementById('clearDrawingBtn');
    if (clearDrawingBtn) {
        clearDrawingBtn.addEventListener('click', () => {
            console.log('描画削除ボタンがクリックされました');
            if (typeof window.clearDrawing === 'function') {
                window.clearDrawing();
                showToast('完了', '描画が削除されました');
            } else {
                console.error('clearDrawing関数が見つかりません');
                showErrorNotification('描画を削除できませんでした');
            }
        });
    }
}

// エラー通知を表示する関数
function showErrorNotification(message) {
    // showToast関数を利用してエラーメッセージを表示
    if (typeof showToast === 'function') {
        showToast('エラー', message);
    } else {
        // showToast関数が存在しない場合はコンソールに出力
        console.error('エラー通知:', message);
        
        // 簡易的なアラートで通知（必要に応じて）
        // alert(`エラー: ${message}`);
    }
}

// タブ切り替え機能のイベントリスナー設定
function setupTabsEventListeners() {
    const statsTab = document.getElementById('statsTab');
    const adviceTab = document.getElementById('adviceTab');
    const statsTabContent = document.getElementById('statsTabContent');
    const adviceTabContent = document.getElementById('adviceTabContent');
    
    if (statsTab && adviceTab && statsTabContent && adviceTabContent) {
        // 詳細統計タブクリック時
        statsTab.addEventListener('click', () => {
            // タブボタンのスタイル切り替え
            statsTab.classList.add('text-blue-600', 'border-blue-600');
            statsTab.classList.remove('text-gray-500', 'border-transparent', 'hover:text-gray-600', 'hover:border-gray-300');
            
            adviceTab.classList.remove('text-blue-600', 'border-blue-600');
            adviceTab.classList.add('text-gray-500', 'border-transparent', 'hover:text-gray-600', 'hover:border-gray-300');
            
            // コンテンツの表示切り替え
            statsTabContent.classList.remove('hidden');
            adviceTabContent.classList.add('hidden');
        });
        
        // AIアドバイスタブクリック時
        adviceTab.addEventListener('click', () => {
            // タブボタンのスタイル切り替え
            adviceTab.classList.add('text-blue-600', 'border-blue-600');
            adviceTab.classList.remove('text-gray-500', 'border-transparent', 'hover:text-gray-600', 'hover:border-gray-300');
            
            statsTab.classList.remove('text-blue-600', 'border-blue-600');
            statsTab.classList.add('text-gray-500', 'border-transparent', 'hover:text-gray-600', 'hover:border-gray-300');
            
            // コンテンツの表示切り替え
            adviceTabContent.classList.remove('hidden');
            statsTabContent.classList.add('hidden');
        });
    }
}

// 認証状態の確認
async function checkAuthStatus() {
    try {
        // デモ版: 認証チェックをスキップし、常に認証済みとして扱う
        console.log('[DEMO MODE] 認証チェックをスキップしています');
        return;
        
        // 以下は本来の認証チェック処理（デモ版では無効化）
        /*
        const response = await fetch('/api/auth-status');
        const data = await response.json();
        
        if (data.authenticated) {
            console.log('認証済みです（モックモード）');
        } else {
            console.log('認証が必要です');
            const analyzeBtn = document.getElementById('analyzeBtn');
            if (analyzeBtn) {
                analyzeBtn.title = "認証が必要です";
                analyzeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.location.href = '/auth';
                }, { once: true });
            }
        }
        */
    } catch (error) {
        console.error('[DEMO MODE] 認証状態の確認をスキップしました:', error);
    }
}

// 複数区画の比較分析UI
function showFieldComparisonUI(fieldIds) {
    if (!fieldIds || fieldIds.length < 2) {
        showToast('エラー', '比較には少なくとも2つの区画が必要です');
        return;
    }
    
    try {
        // 選択された区画の情報を取得
        const fields = getSelectedFields(fieldIds);
        
        if (fields.length < 2) {
            showToast('エラー', '比較対象の区画情報を取得できません');
            return;
        }
        
        // 分析済みの区画のみフィルタリング
        const analyzedFields = fields.filter(field => field.lastAnalysis && field.lastAnalysis.stats);
        
        if (analyzedFields.length < 2) {
            showToast('警告', '分析済みの区画が2つ未満です。比較を行うには、まず各区画を分析してください。');
            return;
        }
        
        // 比較UI表示（未実装）
        showCompletionModal('開発中', '区画比較UIは現在開発中です。今後のアップデートをお待ちください。');
        
    } catch (error) {
        console.error('区画比較UIの表示に失敗しました:', error);
        showToast('エラー', `区画比較の処理中にエラーが発生しました: ${error.message}`);
    }
}

// 一括分析
async function batchAnalyzeFields(fieldIds) {
    if (!fieldIds || fieldIds.length === 0) {
        showToast('エラー', '分析する区画が選択されていません');
        return;
    }
    
    try {
        // 選択された区画の情報を取得
        const fields = getSelectedFields(fieldIds);
        
        if (fields.length === 0) {
            showToast('エラー', '分析対象の区画情報を取得できません');
            return;
        }
        
        showCompletionModal('開発中', '一括分析機能は現在開発中です。今後のアップデートをお待ちください。');
        
    } catch (error) {
        console.error('一括分析の処理中にエラーが発生しました:', error);
        showToast('エラー', `一括分析中にエラーが発生しました: ${error.message}`);
    }
}

// ページ読み込み時の初期化
// document.addEventListener('DOMContentLoaded', initializeUI);

// 描画案内モーダルのイベントリスナー設定
function setupDrawingHelpModalEventListeners() {
    const drawInstructionText = document.getElementById('drawInstructionText');
    const drawingHelpModal = document.getElementById('drawingHelpModal');
    const closeDrawingHelpBtn = document.getElementById('closeDrawingHelpBtn');
    const drawingToolsFocus = document.getElementById('drawingToolsFocus');
    
    // 描画手順テキストクリックでモーダル表示
    if (drawInstructionText) {
        drawInstructionText.addEventListener('click', () => {
            showDrawingHelpModal();
        });
    }
    
    // 閉じるボタンでモーダルを非表示
    if (closeDrawingHelpBtn) {
        closeDrawingHelpBtn.addEventListener('click', () => {
            hideDrawingHelpModal();
        });
    }
    
    // モーダルの背景をクリックしても閉じる
    if (drawingHelpModal) {
        drawingHelpModal.addEventListener('click', (e) => {
            // クリックがモーダルの子要素でない場合のみ閉じる
            if (e.target === drawingHelpModal) {
                hideDrawingHelpModal();
            }
        });
    }
    
    // 描画開始イベントでモーダルを非表示
    document.addEventListener('draw:drawstart', () => {
        hideDrawingHelpModal();
    });
    
    // 描画完了イベントでモーダルを非表示
    document.addEventListener('draw:created', () => {
        hideDrawingHelpModal();
    });
}

// 描画案内モーダルを表示
function showDrawingHelpModal() {
    const drawingHelpModal = document.getElementById('drawingHelpModal');
    const drawingToolsFocus = document.getElementById('drawingToolsFocus');
    
    if (drawingHelpModal) {
        drawingHelpModal.classList.remove('hidden');
        drawingHelpModal.classList.add('flex');
        
        // 描画ツールバーにフォーカスを当てる
        setTimeout(() => {
            const drawToolbar = document.querySelector('.leaflet-draw-toolbar');
            if (drawToolbar && drawingToolsFocus) {
                const rect = drawToolbar.getBoundingClientRect();
                
                // ツールバーの位置にフォーカス用要素を配置
                drawingToolsFocus.style.left = `${rect.left}px`;
                drawingToolsFocus.style.top = `${rect.top}px`;
                drawingToolsFocus.style.width = `${rect.width}px`;
                drawingToolsFocus.style.height = `${rect.height}px`;
                
                drawingToolsFocus.classList.remove('hidden');
            }
        }, 100);
    }
}

// 描画案内モーダルを非表示
function hideDrawingHelpModal() {
    const drawingHelpModal = document.getElementById('drawingHelpModal');
    const drawingToolsFocus = document.getElementById('drawingToolsFocus');
    
    if (drawingHelpModal) {
        drawingHelpModal.classList.add('hidden');
        drawingHelpModal.classList.remove('flex');
    }
    
    if (drawingToolsFocus) {
        drawingToolsFocus.classList.add('hidden');
    }
}

// main.jsから呼び出されるように変更
function initializeUserInterface() {
    initializeUI();
} 