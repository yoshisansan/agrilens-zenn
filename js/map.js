// グローバル変数
let map;
let drawnItems;
let currentAOILayer = null;
let currentAOIGeoJSON = null;
let geeNdviLayer = null;
let baseMaps = {}; // ベースマップレイヤーを格納する変数
let overlayMaps = {}; // オーバーレイレイヤーを格納する変数
let layerControl = null; // レイヤーコントロール
let ndviInitialLoad = true; // NDVIレイヤーの初回ロード管理フラグ
let fieldLayers = {}; // 区画レイヤーを保持するオブジェクト

// 植生指標レイヤーを保存するオブジェクト
const vegetationLayers = {
    ndvi: null,
    ndmi: null,
    ndre: null
};

// DOM要素の参照
const analyzeBtn = document.getElementById('analyzeBtn');
const instructionText = document.getElementById('instructionText');
const analysisResultsEl = document.getElementById('analysisResults');
const mapLoadingOverlay = document.getElementById('mapLoadingOverlay');
const ndviDateInfo = document.getElementById('ndviDateInfo');
const ndviDateRangeEl = document.getElementById('ndviDateRange');

// マップが既に初期化されているかのフラグ
let mapInitialized = false;

// ドキュメント読み込み時にマップを初期化
// document.addEventListener('DOMContentLoaded', initializeMap);

// マップ初期化関数
function initializeMap() {
    // 既に初期化されている場合は処理をスキップ
    if (mapInitialized) {
        console.log('マップは既に初期化されています');
        return;
    }
    
    map = L.map('map', {
        center: CONFIG.MAP.CENTER,
        zoom: CONFIG.MAP.ZOOM
    });

    // ベースマップレイヤーの定義
    const osmLayer = L.tileLayer(CONFIG.MAP.TILE_URL, {
        attribution: CONFIG.MAP.TILE_ATTRIBUTION
    });
    
    const satelliteLayer = L.tileLayer(CONFIG.MAP.SATELLITE_TILE_URL, {
        attribution: CONFIG.MAP.SATELLITE_ATTRIBUTION
    });
    
    // ベースマップの設定
    baseMaps = {
        "OpenStreetMap": osmLayer,
        "衛星画像": satelliteLayer
    };
    
    // デフォルトのベースマップを追加（衛星画像をデフォルトに設定）
    satelliteLayer.addTo(map);
    
    // レイヤーコントロールを追加
    overlayMaps = {}; // 初期化
    layerControl = L.control.layers(baseMaps, overlayMaps, {
        position: 'topright'
    }).addTo(map);

    // 描画レイヤーの初期化
    initializeDrawingLayer();

    // 保存済みの区画を表示
    loadSavedFields();

    // グローバルスコープに公開
    window.map = map;
    window.clearDrawing = clearDrawing; // clearDrawing関数をグローバルに登録
    
    // 描画コントロール初期化
    // 描画コントロールはすでにinitializeDrawingLayer()で初期化されています
    
    // レイヤー切り替えボタンの初期化
    initializeLayerToggleButtons();
    
    // 初期化完了フラグを設定
    mapInitialized = true;
    
    // 初期化完了イベントを発火
    window.dispatchEvent(new Event('mapInitialized'));
    
    console.log('マップの初期化が完了しました');
}

// 描画レイヤーの初期化
function initializeDrawingLayer() {
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        edit: {
            featureGroup: drawnItems,
            remove: true
        },
        draw: {
            polygon: {
                allowIntersection: false,
                shapeOptions: {
                    color: '#FFFF00' // 黄色（リスト登録前）
                }
            },
            rectangle: {
                shapeOptions: {
                    color: '#FFFF00' // 黄色（リスト登録前） 
                }
            },
            polyline: false,
            circle: false,
            marker: false,
            circlemarker: false
        }
    });
    map.addControl(drawControl);

    // 描画イベントリスナーの設定
    setupDrawingEventListeners();
}

// 描画イベントリスナーの設定
function setupDrawingEventListeners() {
    map.on(L.Draw.Event.CREATED, handleDrawingCreated);
    map.on(L.Draw.Event.EDITED, handleDrawingEdited);
    map.on(L.Draw.Event.DELETED, handleDrawingDeleted);
}

// 描画作成時の処理
function handleDrawingCreated(event) {
    const layer = event.layer;
    clearDrawing();
    drawnItems.addLayer(layer);
    currentAOILayer = layer;
    currentAOIGeoJSON = layer.toGeoJSON();
    
    // デバッグログ
    console.log('描画されたGeoJSON:', JSON.stringify(currentAOIGeoJSON));
    console.log('GeoJSON型:', currentAOIGeoJSON.type);
    console.log('GeoJSON座標構造:', currentAOIGeoJSON.coordinates ? 'あり' : 'なし');
    
    analyzeBtn.disabled = false;
    instructionText.textContent = '範囲が選択されました。「選択範囲を分析」ボタンを押してください。';
    
    // 描画完了イベントの発火
    document.dispatchEvent(new CustomEvent('drawingCompleted', {
        detail: { geoJSON: currentAOIGeoJSON }
    }));
}

// 描画編集時の処理
function handleDrawingEdited(event) {
    const layers = event.layers;
    layers.eachLayer(function(layer) {
        currentAOILayer = layer;
        currentAOIGeoJSON = layer.toGeoJSON();
        analyzeBtn.disabled = false;
    });
    
    // 描画更新イベントの発火
    document.dispatchEvent(new CustomEvent('drawingUpdated', {
        detail: { geoJSON: currentAOIGeoJSON }
    }));
}

// 描画削除時の処理
function handleDrawingDeleted() {
    clearDrawing();
    
    // 描画削除イベントの発火
    document.dispatchEvent(new Event('drawingDeleted'));
}

// 描画のクリア
function clearDrawing(hideResults = true) {
    // グローバル変数として登録（他のJSファイルからアクセスできるようにする）
    // arguments.calleeは使用せず、初期化時にグローバル登録する
    drawnItems.clearLayers();
    currentAOILayer = null;
    currentAOIGeoJSON = null;
    analyzeBtn.disabled = true;
    instructionText.innerHTML = '<i class="fas fa-info-circle mr-1"></i> マップ左側の描画ツールを使って分析したい圃場の範囲を選択してください。';
    
    // 分析結果パネルを非表示にするかどうかをオプションで制御
    if (hideResults && analysisResultsEl) {
        analysisResultsEl.classList.add('hidden');
    }
    
    if (geeNdviLayer) {
        map.removeLayer(geeNdviLayer);
        layerControl.removeLayer(geeNdviLayer);
        delete overlayMaps["NDVI"];
        geeNdviLayer = null;
        ndviDateInfo.classList.add('hidden');
    }
}

// 地図の中心を更新
function updateMapCenter(lat, lon, zoom) {
    map.setView([lat, lon], zoom || CONFIG.MAP.ZOOM);
}

// 区画の表示
function displayGeoJSON(geoJSON, color) {
    // 描画レイヤーをクリアするが、分析結果は保持する
    drawnItems.clearLayers();
    currentAOILayer = null;
    currentAOIGeoJSON = null;
    
    // NDVIレイヤーはそのまま保持
    // analysisResultsElは非表示にしない（分析結果を表示したまま）
    
    if (!geoJSON) {
        console.error('表示するGeoJSONデータがありません');
        return;
    }
    
    try {
        // GeoJSONレイヤーを作成
        const layer = L.geoJSON(geoJSON, {
            style: {
                color: color || CONFIG.FIELDS.DEFAULT_COLOR,
                weight: 3,
                opacity: 0.7,
                fillOpacity: 0
            }
        });
        
        // 描画レイヤーに追加
        drawnItems.addLayer(layer);
        
        // 現在のAOIとして設定
        currentAOILayer = layer;
        currentAOIGeoJSON = geoJSON;
        
        // 範囲に合わせてズーム
        map.fitBounds(layer.getBounds());
        
        // 分析ボタンを有効化
        analyzeBtn.disabled = false;
        instructionText.textContent = '区画が選択されました。「選択範囲を分析」ボタンを押してください。';
        
        return layer;
    } catch (error) {
        console.error('GeoJSONの表示に失敗しました:', error);
        return null;
    }
}

// 保存済みの区画を読み込んで表示
function loadSavedFields() {
    if (typeof getFieldsList !== 'function') {
        console.error('getFieldsList関数が定義されていません');
        return;
    }
    
    try {
        // 保存済みの区画を取得
        const fields = getFieldsList();
        
        if (!fields || fields.length === 0) {
            console.log('保存された区画はありません');
            return;
        }
        
        console.log(`${fields.length}個の保存済み区画を読み込みます`);
        
        // 区画レイヤーグループを作成
        const fieldsLayerGroup = L.layerGroup();
        
        // 各区画をマップに表示
        fields.forEach(field => {
            if (!field.geoJSON) return;
            
            try {
                const layer = L.geoJSON(field.geoJSON, {
                    style: {
                        color: field.color || CONFIG.FIELDS.DEFAULT_COLOR,
                        weight: 2,
                        opacity: 0.6,
                        fillOpacity: 0
                    }
                });
                
                // ポップアップを追加
                layer.bindPopup(`
                    <strong>${escapeHtml(field.name)}</strong>
                    ${field.memo ? `<br><small>${escapeHtml(field.memo)}</small>` : ''}
                    <br><small>作成日: ${new Date(field.createdAt).toLocaleDateString()}</small>
                    ${field.lastAnalysis ? 
                        `<br><small>最終分析: ${new Date(field.lastAnalysis.analyzedAt).toLocaleDateString()}</small>` : 
                        ''}
                `);
                
                // 区画レイヤーグループに追加
                fieldsLayerGroup.addLayer(layer);
                
                // IDで参照できるように保存
                fieldLayers[field.id] = layer;
                
            } catch (e) {
                console.error(`区画「${field.name}」の表示に失敗しました:`, e);
            }
        });
        
        // レイヤーグループをマップに追加
        fieldsLayerGroup.addTo(map);
        
        // レイヤーコントロールに追加
        overlayMaps["保存済み区画"] = fieldsLayerGroup;
        layerControl.addOverlay(fieldsLayerGroup, "保存済み区画");
        
    } catch (error) {
        console.error('保存済み区画の読み込みに失敗しました:', error);
        // エラーを上位に伝播させる
        throw new Error(`区画データの読み込みエラー: ${error.message}`);
    }
}

// HTML文字列のエスケープ
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 植生指標レイヤーをクリア
function clearVegetationLayers() {
    // 既存のレイヤーをマップから削除
    Object.values(vegetationLayers).forEach(layer => {
        if (layer) {
            map.removeLayer(layer);
        }
    });
    
    // レイヤーを初期化
    vegetationLayers.ndvi = null;
    vegetationLayers.ndmi = null;
    vegetationLayers.ndre = null;
}

// NDVIレイヤーを追加
function addNdviLayer(tileUrlTemplate, dateRange) {
    if (!tileUrlTemplate) return;
    
    const dateText = dateRange ? `(${dateRange.start} - ${dateRange.end})` : '';
    const ndviLayer = L.tileLayer(tileUrlTemplate, {
        opacity: 0.7,
        attribution: `NDVI ${dateText} © Google Earth Engine`
    });
    
    // レイヤーをマップに追加し、レイヤーコントロールに登録
    vegetationLayers.ndvi = ndviLayer;
    layerControl.addOverlay(ndviLayer, `NDVI（植生指標） ${dateText}`);
    
    // デフォルトで表示
    ndviLayer.addTo(map);
}

// 植生指標の切り替え
function toggleVegetationLayer(layerType) {
    // 既存のレイヤーを非表示にする
    Object.entries(vegetationLayers).forEach(([type, layer]) => {
        if (layer) {
            if (type === layerType) {
                // 指定されたレイヤーを表示
                if (!map.hasLayer(layer)) {
                    map.addLayer(layer);
                }
            } else {
                // その他のレイヤーを非表示
                if (map.hasLayer(layer)) {
                    map.removeLayer(layer);
                }
            }
        }
    });
    
    // ボタンの状態を更新（analysis.jsに定義された関数を使用）
    if (typeof updateLayerToggleButtons === 'function') {
        updateLayerToggleButtons();
    }
}

// レイヤー表示切り替えボタンの初期化
function initializeLayerToggleButtons() {
    const ndviBtn = document.getElementById('toggleNdviBtn');
    const ndmiBtn = document.getElementById('toggleNdmiBtn');
    const ndreBtn = document.getElementById('toggleNdreBtn');
    
    if (ndviBtn) {
        ndviBtn.addEventListener('click', () => {
            toggleVegetationLayer('ndvi');
        });
    }
    
    if (ndmiBtn) {
        ndmiBtn.addEventListener('click', () => {
            toggleVegetationLayer('ndmi');
        });
    }
    
    if (ndreBtn) {
        ndreBtn.addEventListener('click', () => {
            toggleVegetationLayer('ndre');
        });
    }
}

// 複数区画を比較表示
function displayMultipleFields(fieldIds) {
    // 現在の描画をクリア
    clearDrawing();
    
    if (!fieldIds || fieldIds.length === 0) {
        console.error('表示する区画IDがありません');
        return;
    }
    
    try {
        // 指定されたIDの区画を取得
        const fields = getSelectedFields(fieldIds);
        
        if (fields.length === 0) {
            console.error('表示する区画が見つかりません');
            return;
        }
        
        // 複数区画を表示するためのレイヤーグループ
        const multiFieldsLayer = L.featureGroup();
        
        // 各区画をレイヤーに追加
        fields.forEach((field, index) => {
            if (!field.geoJSON) return;
            
            // 異なる色を割り当て
            const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
            const color = colors[index % colors.length];
            
            const layer = L.geoJSON(field.geoJSON, {
                style: {
                    color: color,
                    weight: 3,
                    opacity: 0.8,
                    fillOpacity: 0
                }
            });
            
            // ポップアップを追加
            layer.bindPopup(`<strong>${escapeHtml(field.name)}</strong>`);
            
            // レイヤーグループに追加
            multiFieldsLayer.addLayer(layer);
        });
        
        // マップに追加して範囲に合わせてズーム
        multiFieldsLayer.addTo(map);
        map.fitBounds(multiFieldsLayer.getBounds(), {
            padding: [50, 50]
        });
        
        return multiFieldsLayer;
    } catch (error) {
        console.error('複数区画の表示に失敗しました:', error);
        return null;
    }
}

// フィールド分析の実行
function runAnalysis(fieldId) {
    if (!fieldId) {
        // 現在表示中の区画を分析
        if (!currentAOIGeoJSON) {
            showToast('エラー', '分析する区画が選択されていません');
            return false;
        }
        
        analyzeBtn.click();
        return true;
    }
    
    // 指定されたIDの区画を取得
    const field = getFieldById(fieldId);
    if (!field || !field.geoJSON) {
        showToast('エラー', '分析する区画データが無効です');
        return false;
    }
    
    // 区画を表示（分析結果を保持する）
    displayGeoJSON(field.geoJSON, field.color);
    
    // 分析を実行
    analyzeBtn.click();
    
    return true;
}

function showMapLoading() {
    if (mapLoadingOverlay) {
        mapLoadingOverlay.classList.remove('hidden');
    }
}

function hideMapLoading() {
    if (mapLoadingOverlay) {
        mapLoadingOverlay.classList.add('hidden');
    }
} 