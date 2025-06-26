// グローバル環境変数オブジェクト
window.ENV = window.ENV || {};

// ページ初期化時の処理
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 設定の初期化を最初に実行
        if (window.configManager) {
            await window.configManager.initialize();
        }
        
        // その後にアプリケーションの初期化
        initializeApp();
    } catch (error) {
        console.error('アプリケーション初期化エラー:', error);
        // フォールバックとして基本機能のみ初期化
        initializeApp();
    }
});

// 最新の分析データを保存するグローバル変数
window.latestAnalysisData = null;

// 分析完了時のイベントリスナー
document.addEventListener('analysisCompleted', (event) => {
    // 最新の分析データを保存
    window.latestAnalysisData = event.detail;
    console.log('分析データを保存しました:', window.latestAnalysisData);
});

// 初期状態でのサンプルデータ追加
function initializeSampleDataIfNeeded() {
    try {
        // 現在の圃場数をチェック
        if (typeof getStoredFieldsCount === 'function') {
            const fieldsCount = getStoredFieldsCount();
            console.log(`現在の圃場数: ${fieldsCount}`);
            
            // 圃場データが空の場合にサンプルデータを追加
            if (fieldsCount === 0) {
                console.log('圃場データが空のため、サンプル区画を追加します');
                if (typeof addSampleField === 'function') {
                    addSampleField();
                    
                    // UIを更新
                    if (typeof renderFieldsList === 'function') {
                        renderFieldsList();
                    }
                    if (typeof renderDirectoriesList === 'function') {
                        renderDirectoriesList();
                    }
                    if (typeof loadSavedFields === 'function') {
                        loadSavedFields();
                    }
                    
                    console.log('サンプル区画の追加が完了しました');
                } else {
                    console.error('addSampleField関数が利用できません');
                }
            }
        }
    } catch (error) {
        console.error('初期サンプルデータの追加中にエラーが発生しました:', error);
    }
}

// アプリケーションの初期化関数
function initializeApp() {
    // マップの初期化
    initializeMap();
    
    // イベントリスナーの設定
    // setupEventListeners関数は定義されていないため、コメントアウト
    // 必要なイベントリスナーは各モジュール内で設定されています
    
    // ユーザーインターフェースの初期化
    initializeUserInterface();
    
    // 分析履歴セクションの初期化
    if (typeof updateAnalysisHistorySection === 'function') {
        updateAnalysisHistorySection();
    }
    
    // ローカルストレージから圃場データを読み込む
    try {
        loadSavedFields();
        
        // 初期状態でサンプルデータが必要かチェック
        setTimeout(() => {
            initializeSampleDataIfNeeded();
        }, 100); // UIの初期化完了を待つ
        
    } catch (error) {
        console.error('圃場データの読み込み中にエラーが発生しました:', error);
        // エラー通知を表示（オプション）
        if (typeof showErrorNotification === 'function') {
            showErrorNotification('圃場データの読み込みに失敗しました');
        }
    }
    
    // AIチャットの初期化
    if (typeof window.aiChat !== 'undefined' && typeof window.aiChat.initialize === 'function') {
        window.aiChat.initialize();
        console.log('AIチャット機能を初期化しました');
        
        // チャットUI関連のイベントリスナーを設定
        const chatToggleBtn = document.getElementById('chat-toggle-btn');
        if (chatToggleBtn) {
            // onClick属性と重複を避けるため既存のリスナーを削除
            chatToggleBtn.removeAttribute('onclick');
            // 直接JavaScriptでイベントリスナーを追加
            chatToggleBtn.addEventListener('click', function() {
                console.log('Chat toggle button clicked');
                window.aiChat.togglePanel();
            });
        }
        
        // 閉じるボタンのイベントリスナー
        const chatCloseBtn = document.getElementById('chat-close-btn');
        if (chatCloseBtn) {
            chatCloseBtn.addEventListener('click', function(e) {
                // バブリングを防止
                e.preventDefault();
                e.stopPropagation();
                // チャットパネルを閉じる
                window.aiChat.closePanel();
                const chatPanel = document.getElementById('ai-chat-panel');
                if (chatPanel) {
                    console.log('DOMを直接操作してパネルを非表示にします');
                    chatPanel.classList.add('hidden');
                }
            });
        }
        
        // クリアボタンのイベントリスナー
        const chatClearBtn = document.getElementById('chat-clear-btn');
        if (chatClearBtn) {
            chatClearBtn.addEventListener('click', window.aiChat.clearChat);
        }
    } else {
        console.warn('AIチャットモジュールが見つかりません');
    }
    
    // AIアシスタントの初期化
    if (typeof window.aiAssistant !== 'undefined' && typeof window.aiAssistant.initialize === 'function') {
        window.aiAssistant.initialize();
    }
    
    // AIアシスタント履歴の初期化
    if (typeof window.AiAssistantHistory !== 'undefined' && typeof window.AiAssistantHistory.update === 'function') {
        window.AiAssistantHistory.update();
        console.log('AIアシスタント履歴を初期化しました');
    }
    
    // 定期的にAIアシスタント履歴を更新（分析結果が追加された時に反映）
    setInterval(() => {
        if (typeof window.AiAssistantHistory !== 'undefined' && typeof window.AiAssistantHistory.update === 'function') {
            window.AiAssistantHistory.update();
        }
    }, 30000); // 30秒ごとに更新
} 