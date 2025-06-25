/**
 * データ初期化機能
 * 圃場データ、ディレクトリデータ、分析結果データを初期化する
 */

// SVGパスをGeoJSONに変換する関数
function convertSvgPathToGeoJSON(svgPath, centerLat, centerLng, scale = 0.0001) {
    try {
        // SVGパスのコマンドを解析
        const commands = svgPath.match(/[MLZ][^MLZ]*/g);
        if (!commands) {
            throw new Error('無効なSVGパスです');
        }
        
        const coordinates = [];
        let currentX = 0, currentY = 0;
        
        commands.forEach(command => {
            const type = command[0];
            const params = command.slice(1).trim().split(/[\s,]+/).filter(p => p !== '').map(Number);
            
            switch (type) {
                case 'M': // Move to
                    currentX = params[0];
                    currentY = params[1];
                    coordinates.push([currentX, currentY]);
                    break;
                case 'L': // Line to
                    for (let i = 0; i < params.length; i += 2) {
                        currentX = params[i];
                        currentY = params[i + 1];
                        coordinates.push([currentX, currentY]);
                    }
                    break;
                case 'Z': // Close path
                    if (coordinates.length > 0) {
                        coordinates.push([...coordinates[0]]); // 最初の点に戻る
                    }
                    break;
            }
        });
        
        // SVG座標系を地理座標系に変換
        const geoCoordinates = coordinates.map(point => {
            // SVG座標を正規化 (0-1の範囲にする簡易変換)
            const normalizedX = (point[0] - 300) / 500; // 大体の中心を300として正規化
            const normalizedY = (point[1] - 200) / 300; // 大体の中心を200として正規化
            
            // 地理座標に変換
            const lng = centerLng + (normalizedX * scale);
            const lat = centerLat - (normalizedY * scale); // Yは反転
            
            return [lng, lat];
        });
        
        // GeoJSONフィーチャーを作成
        return {
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [geoCoordinates]
            },
            properties: {}
        };
    } catch (error) {
        console.error('SVGパスの変換に失敗しました:', error);
        return null;
    }
}

// サンプル区画データを作成する関数
function createSampleFieldData() {
    // 提供されたGeoJSONデータを直接使用
    const sampleGeoJSON = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[141.611141,43.336851],[141.611441,43.336063],[141.611688,43.335977],[141.611549,43.335797],[141.611924,43.334931],[141.612107,43.334986],[141.612364,43.335079],[141.612622,43.335064],[141.613062,43.335228],[141.613308,43.335236],[141.613695,43.335267],[141.613362,43.336344],[141.615529,43.336765],[141.615239,43.337631],[141.61495,43.337647],[141.61451,43.337608],[141.611441,43.337007],[141.611141,43.336851]]]
        }
    };
    
    // 中心座標を計算
    const coordinates = sampleGeoJSON.geometry.coordinates[0];
    let sumLat = 0, sumLng = 0;
    for (const coord of coordinates) {
        sumLng += coord[0];
        sumLat += coord[1];
    }
    const centerLng = sumLng / coordinates.length;
    const centerLat = sumLat / coordinates.length;
    
    return {
        name: 'サンプル',
        memo: 'シード用のサンプル区画です',
        crop: '稲',
        center: [centerLat, centerLng],
        geoJSON: sampleGeoJSON,
        color: CONFIG.FIELDS.DEFAULT_COLOR,
        directoryId: 'directory_default' // デフォルトディレクトリに配置
    };
}

// 初期化関数
function initializeAllData() {
    if (!confirm('すべてのデータを削除し、初期状態に戻しますか？\n\n削除されるデータ：\n- 保存された圃場（区画）\n- 圃場ディレクトリ\n- 分析結果・履歴\n\nこの操作は取り消せません。')) {
        return false;
    }

    try {
        // 圃場データの初期化
        clearFieldsData();
        
        // ディレクトリデータの初期化
        clearDirectoriesData();
        
        // 分析結果データの初期化
        clearAnalysisData();
        
        // マップ上の表示をクリア
        clearMapDisplay();
        
        // サンプル区画の追加
        addSampleField();
        
        // UIの更新
        refreshUI();
        
        if (typeof showToast === 'function') {
            showToast('初期化完了', 'すべてのデータを初期化し、サンプル区画を追加しました');
        } else {
            alert('初期化が完了しました');
        }
        
        return true;
    } catch (error) {
        console.error('データ初期化中にエラーが発生しました:', error);
        if (typeof showToast === 'function') {
            showToast('エラー', 'データの初期化に失敗しました');
        } else {
            alert('データの初期化に失敗しました: ' + error.message);
        }
        return false;
    }
}

// 圃場データの初期化
function clearFieldsData() {
    try {
        const storageKey = CONFIG?.FIELDS?.STORAGE_KEY || 'hatake_health_fields';
        localStorage.removeItem(storageKey);
        console.log('圃場データを削除しました');
    } catch (error) {
        console.error('圃場データの削除に失敗しました:', error);
        throw error;
    }
}

// ディレクトリデータの初期化
function clearDirectoriesData() {
    try {
        const storageKey = CONFIG?.DIRECTORIES?.STORAGE_KEY || 'hatake_health_directories';
        localStorage.removeItem(storageKey);
        console.log('ディレクトリデータを削除しました');
    } catch (error) {
        console.error('ディレクトリデータの削除に失敗しました:', error);
        throw error;
    }
}

// 分析結果データの初期化
function clearAnalysisData() {
    try {
        // 分析結果ストレージのキーを削除
        const analysisKeys = [
            'agrilens_analysis_results',
            'agrilens_analysis_history', 
            'agrilens_analysis_settings'
        ];
        
        analysisKeys.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // AnalysisStorageモジュールがある場合はそちらも呼び出し
        if (typeof window.AnalysisStorage !== 'undefined' && 
            typeof window.AnalysisStorage.clear === 'function') {
            window.AnalysisStorage.clear();
        }
        
        console.log('分析結果データを削除しました');
    } catch (error) {
        console.error('分析結果データの削除に失敗しました:', error);
        throw error;
    }
}

// マップ表示のクリア
function clearMapDisplay() {
    try {
        // 現在のAOIレイヤーをクリア
        if (typeof window.currentAOILayer !== 'undefined' && window.currentAOILayer) {
            if (typeof window.map !== 'undefined' && window.map.hasLayer(window.currentAOILayer)) {
                window.map.removeLayer(window.currentAOILayer);
            }
            window.currentAOILayer = null;
        }
        
        // 描画アイテムをクリア
        if (typeof window.drawnItems !== 'undefined' && window.drawnItems) {
            window.drawnItems.clearLayers();
        }
        
        // 植生レイヤーをクリア
        if (typeof clearVegetationLayers === 'function') {
            clearVegetationLayers();
        }
        
        // 選択中の圃場IDをクリア
        window.currentFieldId = null;
        window.currentAOIGeoJSON = null;
        
        console.log('マップ表示をクリアしました');
    } catch (error) {
        console.error('マップ表示のクリアに失敗しました:', error);
        // マップのクリアはエラーがあっても処理を続行
    }
}

// UIの更新
function refreshUI() {
    try {
        // サイドバーのフィールドリストを更新
        if (typeof renderFieldsList === 'function') {
            renderFieldsList();
        }
        
        // ディレクトリリストを更新
        if (typeof renderDirectoriesList === 'function') {
            renderDirectoriesList();
        }
        
        // 分析結果エリアを非表示
        const analysisResults = document.getElementById('analysisResults');
        if (analysisResults) {
            analysisResults.classList.add('hidden');
        }
        
        // 分析履歴セクションを更新
        if (typeof updateAnalysisHistorySection === 'function') {
            updateAnalysisHistorySection();
        }
        
        // 分析ボタンを無効化
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.disabled = true;
        }
        
        // 説明テキストをリセット
        const instructionText = document.getElementById('instructionText');
        if (instructionText) {
            instructionText.textContent = 'マップ左側の描画ツールを使って分析したい圃場の範囲を選択してください。';
        }
        
        console.log('UIを更新しました');
    } catch (error) {
        console.error('UIの更新に失敗しました:', error);
        // UIの更新はエラーがあっても処理を続行
    }
}

// 確認ダイアログ付きの初期化（より詳細）
function confirmAndInitialize() {
    const currentFieldsCount = getStoredFieldsCount();
    const currentDirectoriesCount = getStoredDirectoriesCount();
    const currentAnalysisCount = getStoredAnalysisCount();
    
    const message = `現在のデータ状況：
• 保存された圃場：${currentFieldsCount}個
• 圃場ディレクトリ：${currentDirectoriesCount}個  
• 分析結果：${currentAnalysisCount}件

すべてのデータを削除し、初期状態に戻しますか？
この操作は取り消せません。`;

    if (!confirm(message)) {
        return false;
    }
    
    return initializeAllData();
}

// 保存されたデータ数を取得する補助関数
function getStoredFieldsCount() {
    try {
        const storageKey = CONFIG?.FIELDS?.STORAGE_KEY || 'hatake_health_fields';
        const fieldsData = localStorage.getItem(storageKey);
        return fieldsData ? JSON.parse(fieldsData).length : 0;
    } catch (error) {
        return 0;
    }
}

function getStoredDirectoriesCount() {
    try {
        const storageKey = CONFIG?.DIRECTORIES?.STORAGE_KEY || 'hatake_health_directories';
        const dirData = localStorage.getItem(storageKey);
        return dirData ? JSON.parse(dirData).length : 0;
    } catch (error) {
        return 0;
    }
}

function getStoredAnalysisCount() {
    try {
        if (typeof window.AnalysisStorage !== 'undefined' && 
            typeof window.AnalysisStorage.getHistory === 'function') {
            return window.AnalysisStorage.getHistory().length;
        }
        
        // フォールバック：直接ローカルストレージから取得
        const historyData = localStorage.getItem('agrilens_analysis_history');
        return historyData ? JSON.parse(historyData).length : 0;
    } catch (error) {
        return 0;
    }
}

// 部分的な初期化関数（個別削除用）
function clearFieldsOnly() {
    if (!confirm('保存された圃場データをすべて削除しますか？')) {
        return false;
    }
    
    try {
        clearFieldsData();
        clearMapDisplay();
        
        if (typeof renderFieldsList === 'function') {
            renderFieldsList();
        }
        
        if (typeof showToast === 'function') {
            showToast('削除完了', '圃場データを削除しました');
        }
        return true;
    } catch (error) {
        if (typeof showToast === 'function') {
            showToast('エラー', '圃場データの削除に失敗しました');
        }
        return false;
    }
}

function clearDirectoriesOnly() {
    if (!confirm('圃場ディレクトリをすべて削除しますか？')) {
        return false;
    }
    
    try {
        clearDirectoriesData();
        
        if (typeof renderDirectoriesList === 'function') {
            renderDirectoriesList();
        }
        
        if (typeof showToast === 'function') {
            showToast('削除完了', 'ディレクトリデータを削除しました');
        }
        return true;
    } catch (error) {
        if (typeof showToast === 'function') {
            showToast('エラー', 'ディレクトリデータの削除に失敗しました');
        }
        return false;
    }
}

function clearAnalysisOnly() {
    if (!confirm('分析結果・履歴をすべて削除しますか？')) {
        return false;
    }
    
    try {
        clearAnalysisData();
        
        if (typeof updateAnalysisHistorySection === 'function') {
            updateAnalysisHistorySection();
        }
        
        if (typeof showToast === 'function') {
            showToast('削除完了', '分析結果を削除しました');
        }
        return true;
    } catch (error) {
        if (typeof showToast === 'function') {
            showToast('エラー', '分析結果の削除に失敗しました');
        }
        return false;
    }
}

// サンプル区画を追加する関数
function addSampleField() {
    try {
        // ディレクトリが確実に存在することを保証
        if (typeof getDirectoriesList === 'function') {
            getDirectoriesList(); // これによりデフォルトディレクトリが作成される
        }
        
        // サンプル区画データを作成
        const sampleFieldData = createSampleFieldData();
        if (!sampleFieldData) {
            throw new Error('サンプル区画データの作成に失敗しました');
        }
        
        // addField関数が利用可能かチェック
        if (typeof addField === 'function') {
            const newField = addField(sampleFieldData);
            console.log('サンプル区画を追加しました:', newField);
        } else {
            console.error('addField関数が利用できません');
        }
    } catch (error) {
        console.error('サンプル区画の追加に失敗しました:', error);
        // サンプル区画の追加に失敗しても初期化処理は続行
    }
}

// グローバルに関数を公開
if (typeof window !== 'undefined') {
    window.initializeAllData = initializeAllData;
    window.confirmAndInitialize = confirmAndInitialize;
    window.clearFieldsOnly = clearFieldsOnly;
    window.clearDirectoriesOnly = clearDirectoriesOnly;
    window.clearAnalysisOnly = clearAnalysisOnly;
    window.addSampleField = addSampleField;
    window.createSampleFieldData = createSampleFieldData;
    window.convertSvgPathToGeoJSON = convertSvgPathToGeoJSON;
    window.getStoredFieldsCount = getStoredFieldsCount;
    window.getStoredDirectoriesCount = getStoredDirectoriesCount;
    window.getStoredAnalysisCount = getStoredAnalysisCount;
}