require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { OAuth2Client } = require('google-auth-library');
const path = require('path');
const cors = require('cors');
const ee = require('@google/earthengine');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '.'))); // 静的ファイルを提供
app.use(session({
    secret: process.env.SESSION_SECRET || require('crypto').randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: false
}));

// OAuth2クライアントの設定
const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback'
);

// 環境変数の検証
const hasFileAuth = process.env.GOOGLE_PRIVATE_KEY_PATH;
const hasEnvAuth = process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PROJECT_ID;

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.log('警告: OAuth2認証に必要な環境変数が設定されていません。');
    console.log('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET が必要です。');
}

if (!hasFileAuth && !hasEnvAuth) {
    console.log('警告: Earth Engine認証に必要な環境変数が設定されていません。');
    console.log('以下のいずれかの方法で設定してください:');
    console.log('1. GOOGLE_PRIVATE_KEY_PATH (JSONファイルのパス)');
    console.log('2. GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL, GOOGLE_PROJECT_ID (環境変数)');
}

// Earth Engineの初期化
function initializeEarthEngine() {
    return new Promise((resolve, reject) => {
        try {
            let privateKeyJson;
            
            // 環境変数から認証情報を構築
            if (process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PROJECT_ID) {
                console.log('環境変数からサービスアカウント認証情報を構築します');
                privateKeyJson = {
                    type: "service_account",
                    project_id: process.env.GOOGLE_PROJECT_ID,
                    private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || "",
                    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                    client_email: process.env.GOOGLE_CLIENT_EMAIL,
                    client_id: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID || "",
                    auth_uri: "https://accounts.google.com/o/oauth2/auth",
                    token_uri: "https://oauth2.googleapis.com/token",
                    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.GOOGLE_CLIENT_EMAIL)}`
                };
            }
            // JSONファイルから認証情報を読み込む（従来の方法）
            else if (process.env.GOOGLE_PRIVATE_KEY_PATH) {
                console.log('JSONファイルからサービスアカウント認証情報を読み込みます');
                const keyPath = process.env.GOOGLE_PRIVATE_KEY_PATH;
                const keyFile = path.resolve(__dirname, keyPath);
                
                if (!fs.existsSync(keyFile)) {
                    throw new Error(`指定されたキーファイルが見つかりません: ${keyFile}`);
                }
                
                privateKeyJson = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
            }
            else {
                throw new Error('サービスアカウント認証情報が設定されていません');
            }
            
            ee.data.authenticateViaPrivateKey(
                privateKeyJson,
                () => {
                    console.log('Earth Engine認証成功');
                    ee.initialize(null, null, () => {
                        console.log('Earth Engine初期化成功');
                        resolve();
                    }, (err) => {
                        console.error('Earth Engine初期化エラー:', err);
                        reject(err);
                    });
                },
                (err) => {
                    console.error('Earth Engine認証エラー:', err);
                    reject(err);
                }
            );
        } catch (error) {
            console.error('Earth Engine初期化中にエラーが発生しました:', error);
            reject(error);
        }
    });
}

// サーバーの起動
let server;
function startServer() {
    try {
        server = app.listen(port, () => {
            console.log(`サーバーが起動しました: http://localhost:${port}`);
            displayStatus();
        });
        
        // サーバーエラーハンドリング
        server.on('error', (err) => {
            console.error('サーバーエラーが発生しました:', err);
        });
    } catch (err) {
        console.error('サーバー起動中にエラーが発生しました:', err);
    }
}

// サーバーのステータス表示
function displayStatus() {
    // Earth Engineの初期化状況によってメッセージを変更
    if (earthEngineInitialized) {
        console.log('Google Earth Engineに接続しています。実際の衛星データを使用します。');
    } else {
        console.log('注意: Google Earth Engineに接続できません。モックデータを使用します。');
        console.log('Earth Engineを使用するには、.envファイルに正しい認証情報を設定してください。');
    }
    
    // 設定情報表示
    console.log('環境設定:');
    console.log(`- ポート: ${port}`);
    console.log(`- Google Earth Engine: ${earthEngineInitialized ? '有効' : '無効 (モック)'}`);
}

// エラーハンドリング - 未処理の例外をキャッチ
process.on('uncaughtException', (err) => {
    console.error('未処理の例外が発生しました:', err);
    console.log('サーバーは実行を継続します');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('未処理のPromiseリジェクションが発生しました:', reason);
    console.log('サーバーは実行を継続します');
});

// プロセス終了シグナルのハンドリング
process.on('SIGTERM', () => {
    console.log('SIGTERMシグナルを受信しました。グレースフルシャットダウンを開始します...');
    if (server) {
        server.close(() => {
            console.log('サーバーを正常に終了しました。');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

process.on('SIGINT', () => {
    console.log('SIGINTシグナルを受信しました。グレースフルシャットダウンを開始します...');
    if (server) {
        server.close(() => {
            console.log('サーバーを正常に終了しました。');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

// Earth Engineの初期化を試み、その後サーバーを起動
let earthEngineInitialized = false;

// まずサーバーを起動
console.log('サーバーを起動しています...');
startServer();

// 次にEarth Engineの初期化を試みる
console.log('Earth Engineの初期化を開始します...');
try {
    initializeEarthEngine()
        .then(() => {
            console.log('Earth Engineの初期化が完了しました');
            earthEngineInitialized = true; // ここでフラグを設定
            console.log('リアルタイムの衛星データが利用可能になりました');
            
            // 初期化成功後に再度ステータスを表示
            displayStatus();
            
            // テスト用に簡単なGEE操作を実行
            try {
                console.log('Earth Engineテスト操作を実行します...');
                const point = ee.Geometry.Point([0, 0]);
                const info = point.getInfo();
                console.log('Earth Engineテスト操作成功:', info);
            } catch (testErr) {
                console.error('Earth Engineテスト操作でエラーが発生しました:', testErr);
            }
        })
        .catch(err => {
            console.error('Earth Engineの初期化に失敗しました:', err);
            console.log('モックデータモードで動作します');
        });
} catch (err) {
    console.error('Earth Engine初期化処理でエラーが発生しました:', err);
}

// 認証ルート
app.get('/auth', (req, res) => {
    // モックデータを使用するため、簡易的な認証処理
    req.session.authenticated = true;
    res.redirect('/');
});

// コールバックルート - 認証後に呼び出されるURL
app.get('/auth/callback', async (req, res) => {
    const { code } = req.query;
    console.log('認証コールバック受信:', req.url);
    
    // モックデータを使用するため、簡易的な認証処理
    req.session.authenticated = true;
    res.redirect('/');
});

// GEE分析API - 実際のGEEアクセス
app.post('/api/analyze', async (req, res) => {
    try {
        console.log('分析リクエスト受信');
        
        // AOIデータの取得
        const { aoiGeoJSON } = req.body;
        console.log('受信したGeoJSONデータ:', JSON.stringify(aoiGeoJSON));
        
        // AOIデータの検証
        if (!aoiGeoJSON) {
            console.error('GeoJSONデータが見つかりません');
            return res.status(400).json({ error: 'GeoJSONデータが見つかりません' });
        }
        
        if (!aoiGeoJSON.type) {
            console.error('GeoJSONタイプが見つかりません:', aoiGeoJSON);
            return res.status(400).json({ error: 'GeoJSONタイプが見つかりません' });
        }
        
        if (!aoiGeoJSON.coordinates || !Array.isArray(aoiGeoJSON.coordinates)) {
            console.error('座標データが無効です:', aoiGeoJSON);
            return res.status(400).json({ error: '座標データが無効です' });
        }
        
        // Earth Engineが初期化されていない場合はモックデータを返す
        if (!earthEngineInitialized) {
            console.log('Earth Engineが初期化されていないため、モックデータを返します');
            const mockData = generateMockVegetationData(aoiGeoJSON);
            await new Promise(resolve => setTimeout(resolve, 2000));
            console.log('モックデータ送信:', mockData);
            return res.json(mockData);
        }
        
        console.log('AOIデータ検証完了 - GEE処理開始');
        
        // GeoJSONをEarth Engine Geometryに変換
        const geometry = ee.Geometry[aoiGeoJSON.type](aoiGeoJSON.coordinates);
        
        // 日付範囲の設定
        const startDate = '2024-01-01';
        const endDate = new Date().toISOString().split('T')[0]; // 今日まで
        
        // Sentinel-2コレクションの取得と前処理
        const s2Collection = ee.ImageCollection('COPERNICUS/S2_SR')
            .filterDate(startDate, endDate)
            .filterBounds(geometry)
            .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
            .sort('system:time_start', false); // 最新の画像が最初に来るようにソート
        
        // コレクションの最初の画像を取得（最新の画像）
        const image = s2Collection.first();
        
        // 画像がない場合のエラーハンドリング
        const countImages = s2Collection.size().getInfo();
        if (countImages === 0) {
            console.error('選択した範囲と時間枠では利用可能な画像がありません');
            return res.status(404).json({ 
                error: '選択した範囲と時間枠では利用可能な画像がありません',
                details: '日付範囲や雲フィルタを調整してみてください'
            });
        }
        
        // タイムスタンプを取得して日付形式に変換
        const imageDate = ee.Date(image.get('system:time_start')).format('yyyy-MM-dd').getInfo();
        console.log('使用する画像の日付:', imageDate);
        
        // 植生指標の計算
        // NDVI (正規化差植生指数)
        const ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
        
        // NDMI (正規化差水分指数)
        const ndmi = image.normalizedDifference(['B8', 'B11']).rename('NDMI');
        
        // NDRE (Red Edge 正規化差植生指数)
        const ndre = image.normalizedDifference(['B8', 'B5']).rename('NDRE');
        
        // 3つの指標を結合
        const indices = ee.Image.cat([ndvi, ndmi, ndre]);
        
        // 指標の統計情報を計算
        const stats = indices.reduceRegion({
            reducer: ee.Reducer.mean().combine(ee.Reducer.stdDev(), '', true)
                .combine(ee.Reducer.minMax(), '', true),
            geometry: geometry,
            scale: 10,
            maxPixels: 1e9
        }).getInfo();
        
        console.log('GEE分析結果:', stats);
        
        // 各指標のマップタイルを生成
        // NDVI可視化パラメータ
        const ndviVis = {
            min: -1,
            max: 1,
            palette: ['red', 'yellow', 'green']
        };
        
        // NDMI可視化パラメータ
        const ndmiVis = {
            min: -1,
            max: 1,
            palette: ['red', 'yellow', 'blue']
        };
        
        // NDRE可視化パラメータ
        const ndreVis = {
            min: -1,
            max: 1,
            palette: ['red', 'yellow', 'green']
        };
        
        // 各指標のマップIDとURLテンプレートの取得
        const ndviMapId = await ndvi.getMapId(ndviVis);
        const ndmiMapId = await ndmi.getMapId(ndmiVis);
        const ndreMapId = await ndre.getMapId(ndreVis);
        
        // マップIDの詳細構造をログに出力して調査
        console.log('NDVI MapID詳細:', JSON.stringify(ndviMapId, null, 2));
        
        const ndviTileUrlTemplate = getMapTileUrl(ndviMapId);
        const ndmiTileUrlTemplate = getMapTileUrl(ndmiMapId);
        const ndreTileUrlTemplate = getMapTileUrl(ndreMapId);
        
        // クライアントに送信するデータを構築
        const result = {
            dateRange: {
                start: imageDate,
                end: imageDate
            },
            stats: stats,
            // 各指標のタイルURLテンプレート
            ndviTileUrlTemplate: ndviTileUrlTemplate,
            ndmiTileUrlTemplate: ndmiTileUrlTemplate,
            ndreTileUrlTemplate: ndreTileUrlTemplate
        };
        
        console.log('クライアントへの応答を準備:', result);
        res.json(result);
    } catch (error) {
        console.error('GEE分析中にエラーが発生しました:', error);
        res.status(500).json({ 
            error: 'サーバー内部エラー', 
            details: error.message 
        });
    }
});

// タイルURLテンプレートの生成関数
function getMapTileUrl(mapId) {
    if (!mapId) {
        console.warn('mapIdが提供されていません');
        return null;
    }
    
    // マップIDオブジェクトの全体構造をより詳細に調査
    console.log('MapID構造キー:', Object.keys(mapId));
    
    // 異なるAPIバージョンに対応する複数のプロパティをチェック
    if (mapId.tile_fetcher && mapId.tile_fetcher.url_format) {
        console.log('tile_fetcher.url_format 形式を使用');
        return mapId.tile_fetcher.url_format;
    } 
    else if (mapId.tile_fetcher && mapId.tile_fetcher.url_format_string) {
        console.log('tile_fetcher.url_format_string 形式を使用');
        return mapId.tile_fetcher.url_format_string;
    }
    else if (mapId.urlFormat) {
        console.log('urlFormat 形式を使用');
        return mapId.urlFormat;
    }
    else if (mapId.formatTileUrl) {
        console.log('formatTileUrl が関数として存在');
        try {
            // formatTileUrlが関数の場合、サンプル座標でテスト
            const testUrl = mapId.formatTileUrl(0, 0, 0);
            const urlPattern = testUrl.replace('0', '{z}').replace('0', '{x}').replace('0', '{y}');
            console.log('推測されたURL形式:', urlPattern);
            return urlPattern;
        } catch (e) {
            console.error('formatTileUrl関数の呼び出しに失敗:', e);
        }
    }
    
    // mapIdのすべてのプロパティの型を調査
    for (const key in mapId) {
        const value = mapId[key];
        const type = typeof value;
        console.log(`キー: ${key}, 型: ${type}, 値: ${type === 'object' ? (value ? 'Object' : 'null') : value}`);
        
        // オブジェクトの場合は中身も調査
        if (type === 'object' && value) {
            console.log(`${key}の中身:`, Object.keys(value));
        }
    }
    
    // それでも見つからない場合はダミーURLを返す
    console.warn('標準形式のタイルURLが見つかりません。モックURLを返します');
    return `https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/${Math.random().toString(36).substring(2, 10)}/tiles/{z}/{x}/{y}`;
}

// モック植生指標データの生成
function generateMockVegetationData(aoiGeoJSON) {
    // ハッシュ値に基づいたモックデータ生成（一貫性のある値を生成するため）
    const getHashValue = (coordinates) => {
        const str = JSON.stringify(coordinates);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bitに変換
        }
        return Math.abs(hash) / 2147483647; // 0-1の範囲に正規化
    };
    
    // 座標から基本値を生成
    const baseValue = getHashValue(aoiGeoJSON.coordinates);
    
    // 各指標の乱数生成関数
    const randomizeIndex = (base, min, max) => {
        // baseを中心にして範囲内の値を生成
        const range = max - min;
        const deviation = (Math.random() * 0.4) - 0.2; // -0.2から0.2の範囲
        let value = base + deviation;
        
        // 範囲内に収める
        value = Math.max(min, Math.min(max, value));
        return value;
    };
    
    // NDVI値の生成（0.3-0.7の範囲）
    const ndviBase = randomizeIndex(baseValue, 0.3, 0.7);
    
    // NDMI値の生成（0.05-0.4の範囲）
    const ndmiBase = randomizeIndex(baseValue * 0.5, 0.05, 0.4);
    
    // NDRE値の生成（0.05-0.3の範囲）
    const ndreBase = randomizeIndex(baseValue * 0.4, 0.05, 0.3);
    
    // 各指標のばらつき（標準偏差）
    const ndviStdDev = Math.random() * 0.15 + 0.05;
    const ndmiStdDev = Math.random() * 0.1 + 0.03;
    const ndreStdDev = Math.random() * 0.08 + 0.02;
    
    // 各指標の最小・最大生成
    const ndviMin = Math.max(0, ndviBase - ndviStdDev * 2);
    const ndviMax = Math.min(1, ndviBase + ndviStdDev * 2);
    
    const ndmiMin = Math.max(-0.2, ndmiBase - ndmiStdDev * 2);
    const ndmiMax = Math.min(0.6, ndmiBase + ndmiStdDev * 2);
    
    const ndreMin = Math.max(-0.1, ndreBase - ndreStdDev * 2);
    const ndreMax = Math.min(0.5, ndreBase + ndreStdDev * 2);
    
    // 日付範囲のモックデータ
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - Math.floor(Math.random() * 10 + 5)); // 5-15日前
    
    // 統計データ整形
    const stats = {
        'NDVI_mean': ndviBase,
        'NDVI_stdDev': ndviStdDev,
        'NDVI_min': ndviMin,
        'NDVI_max': ndviMax,
        'NDMI_mean': ndmiBase,
        'NDMI_stdDev': ndmiStdDev,
        'NDMI_min': ndmiMin,
        'NDMI_max': ndmiMax,
        'NDRE_mean': ndreBase,
        'NDRE_stdDev': ndreStdDev,
        'NDRE_min': ndreMin,
        'NDRE_max': ndreMax
    };
    
    // モックタイルURL（実際にはGEEから生成されるURLを模倣）
    // 全てのレイヤーに対して異なるURLを生成
    const ndviTileUrl = `https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/${Math.random().toString(36).substring(2, 10)}/tiles/{z}/{x}/{y}`;
    const ndmiTileUrl = `https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/${Math.random().toString(36).substring(2, 10)}/tiles/{z}/{x}/{y}`;
    const ndreTileUrl = `https://earthengine.googleapis.com/v1alpha/projects/earthengine-legacy/maps/${Math.random().toString(36).substring(2, 10)}/tiles/{z}/{x}/{y}`;
    
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    return {
        dateRange: {
            start: startDate.toISOString().split('T')[0],
            end: today.toISOString().split('T')[0]
        },
        stats: stats,
        ndviTileUrlTemplate: ndviTileUrl,
        ndmiTileUrlTemplate: ndmiTileUrl,
        ndreTileUrlTemplate: ndreTileUrl
    };
}

// NDVIモックデータ生成関数（後方互換性のため残す）
function generateMockNDVIData(aoiGeoJSON) {
    return generateMockVegetationData(aoiGeoJSON);
}

// 認証ステータスチェック
app.get('/api/auth-status', (req, res) => {
    res.json({ authenticated: true });  // モックデータを使用するため常に認証済みとして扱う
});

// ルートパスへのアクセス
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Gemini APIをサーバーサイドで呼び出し、クライアントに結果だけを返す安全な方法

// APIプロバイダーの設定読み込み
const API_PROVIDER = process.env.AI_API_PROVIDER || 'gemini-direct';
const AI_MODEL = process.env.AI_MODEL || 'gemini-1.5-flash';
const GOOGLE_PROJECT_ID = process.env.GOOGLE_PROJECT_ID;
const GOOGLE_CLOUD_REGION = process.env.GOOGLE_CLOUD_REGION || 'asia-northeast1'; // Tokyo region

// サービスアカウント認証情報を環境変数から構成
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY_ID = process.env.GOOGLE_PRIVATE_KEY_ID;

// Vertex AI用のインポート（npmインストール後有効になる）
let VertexAI;
try {
  VertexAI = require('@google-cloud/vertexai');
} catch (error) {
  console.warn('Vertex AI SDKが見つかりません。npm install @google-cloud/vertexai を実行してください');
}

// 統合されたAI APIエンドポイント
app.post('/api/ai-advice', async (req, res) => {
  const fetch = await import('node-fetch').then(module => module.default);
  
  try {
    const { prompt, model } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "プロンプトが必要です" });
    }

    const selectedModel = model || AI_MODEL;
    console.log(`AI APIリクエスト - Provider: ${API_PROVIDER}, Model: ${selectedModel}`);

    let result;
    
    if (API_PROVIDER === 'vertex' && VertexAI) {
      result = await handleVertexAIRequest(prompt, selectedModel);
    } else {
      // フォールバック: 従来のGemini APIを使用
      result = await handleDirectGeminiRequest(prompt, selectedModel, fetch);
    }

    res.json({ success: true, result });
  } catch (error) {
    console.error('AI APIリクエストエラー:', error);
    res.status(500).json({ error: "サーバーエラー", message: error.message });
  }
});

// Vertex AI経由でのリクエスト処理
async function handleVertexAIRequest(prompt, modelName) {
  if (!GOOGLE_PROJECT_ID) {
    throw new Error('GOOGLE_PROJECT_IDが設定されていません');
  }

  // 環境変数からサービスアカウント情報を構成
  if (!GOOGLE_PRIVATE_KEY || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY_ID) {
    throw new Error('サービスアカウント情報（GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY_ID）が設定されていません');
  }

  // サービスアカウントキーオブジェクトを構成
  const serviceAccountKey = {
    type: 'service_account',
    project_id: GOOGLE_PROJECT_ID,
    private_key_id: GOOGLE_PRIVATE_KEY_ID,
    private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'), // 改行文字の変換
    client_email: GOOGLE_CLIENT_EMAIL,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(GOOGLE_CLIENT_EMAIL)}`
  };

  const vertexAI = new VertexAI.VertexAI({
    project: GOOGLE_PROJECT_ID,
    location: GOOGLE_CLOUD_REGION,
    googleAuthOptions: {
      credentials: serviceAccountKey
    }
  });

  // モデルタイプによる分岐
  if (modelName.startsWith('gemma')) {
    return handleGemmaRequest(vertexAI, prompt, modelName);
  } else {
    return handleGeminiVertexRequest(vertexAI, prompt, modelName);
  }
}

// Vertex AI経由でのGeminiリクエスト
async function handleGeminiVertexRequest(vertexAI, prompt, modelName) {
  const model = vertexAI.preview.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
    },
  });

  // プロンプトがJSON形式を要求しているかチェック
  const isJsonRequest = prompt.includes('JSON') || prompt.includes('JSONスキーマ');
  
  const request = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  };

  if (isJsonRequest) {
    request.generationConfig = {
      ...request.generationConfig,
      responseMimeType: "application/json"
    };
  }

  const result = await model.generateContent(request);
  const response = await result.response;
  return response.candidates[0].content.parts[0].text;
}

// Vertex AI経由でのGemmaリクエスト
async function handleGemmaRequest(vertexAI, prompt, modelName) {
  const model = vertexAI.preview.getGenerativeModel({
    model: modelName,
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
    },
  });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });

  const response = await result.response;
  return response.candidates[0].content.parts[0].text;
}

// 従来の直接Gemini APIリクエスト（フォールバック用）
async function handleDirectGeminiRequest(prompt, modelName, fetch) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEYが設定されていません');
  }

  // Geminiモデルのみサポート
  if (modelName.startsWith('gemma')) {
    throw new Error('直接APIではGemmaモデルはサポートされていません。Vertex AIを使用してください。');
  }

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  const isJsonRequest = prompt.includes('JSON') || prompt.includes('JSONスキーマ');
  
  const requestBody = {
    contents: [{ 
      role: 'user', 
      parts: [{ text: prompt }] 
    }],
    generationConfig: {
      temperature: 0.3,
      topP: 0.8,
      topK: 40,
      maxOutputTokens: 8192
    }
  };

  if (isJsonRequest) {
    requestBody.generationConfig.responseMimeType = "application/json";
  }

  const response = await fetch(`${apiUrl}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini APIエラー: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  if (data.candidates && data.candidates[0] && 
      data.candidates[0].content && data.candidates[0].content.parts && 
      data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
    return data.candidates[0].content.parts[0].text;
  } else {
    throw new Error('予期しないレスポンス形式');
  }
}

// Gemini APIへのリクエストを処理するエンドポイント（後方互換性のため残す）
app.post('/api/gemini-advice', async (req, res) => {
  const fetch = await import('node-fetch').then(module => module.default);
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "APIキー未設定",
        message: "Gemini APIキーがサーバーに設定されていません。"
      });
    }
    
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "プロンプトが必要です" });
    }
    
    // プロンプトがJSON形式を要求しているかチェック
    const isJsonRequest = prompt.includes('JSON') || prompt.includes('JSONスキーマ') || prompt.includes('"type": "object"');
    
    // Gemini APIにリクエストを送信 - 最新の安定版モデルを使用
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    console.log('使用モデル:', 'gemini-1.5-flash', 'JSON形式要求:', isJsonRequest, 'プロンプト先頭:', prompt.substring(0, 100) + '...');
    
    const requestBody = {
      contents: [{ 
        role: 'user', 
        parts: [{ text: prompt }] 
      }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 8192
      }
    };
    
    // JSON形式が要求されている場合のみresponseMimeTypeを設定
    if (isJsonRequest) {
      requestBody.generationConfig.responseMimeType = "application/json";
    }
    
    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    const responseText = await response.text();
    console.log('Gemini APIレスポンス受信:', response.status, responseText.substring(0, 200) + '...');
    
    if (!response.ok) {
      console.error('Gemini APIエラー:', response.status, responseText);
      return res.status(response.status).json({
        error: "Gemini APIエラー",
        details: responseText,
        status: response.status
      });
    }
    
    try {
      // APIレスポンスをクライアントに返す
      const data = JSON.parse(responseText);
      if (data.candidates && data.candidates[0] && 
          data.candidates[0].content && data.candidates[0].content.parts && 
          data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
        console.log('✅ Gemini APIから正常なレスポンスを取得しました');
        res.json({ success: true, result: data.candidates[0].content.parts[0].text });
      } else {
        console.error('⚠️ Gemini APIから予期しない形式のレスポンス:', data);
        res.status(500).json({ error: "不正なレスポンス形式", details: data });
      }
    } catch (parseError) {
      console.error('❌ Gemini APIレスポンスのパースエラー:', parseError);
      res.status(500).json({ 
        error: "レスポンス解析エラー", 
        details: parseError.message,
        rawResponse: responseText 
      });
    }
  } catch (error) {
    console.error('Gemini APIリクエストエラー:', error);
    res.status(500).json({ error: "サーバーエラー", message: error.message });
  }
});

// Gemini API接続テスト用エンドポイント
app.get('/api/gemini-test', async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        status: 'error',
        message: 'GEMINI_API_KEYが設定されていません',
        hasApiKey: false
      });
    }
    
    // 簡単なテストプロンプト
    const testPrompt = 'こんにちは。簡潔に挨拶を返してください。';
    
    const fetch = await import('node-fetch').then(module => module.default);
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
    
    const response = await fetch(`${apiUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{ 
          role: 'user', 
          parts: [{ text: testPrompt }] 
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 100
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      res.json({
        status: 'success',
        message: 'Gemini APIとの接続が正常です',
        hasApiKey: true,
        testResponse: text || 'レスポンス形式が予期しない',
        apiKeyExists: !!apiKey,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 4) + '***' : 'なし'
      });
    } else {
      const errorText = await response.text();
      res.json({
        status: 'api_error',
        message: `Gemini APIエラー: ${response.status}`,
        hasApiKey: true,
        error: errorText
      });
    }
  } catch (error) {
    res.json({
      status: 'error',
      message: `接続テストエラー: ${error.message}`,
      hasApiKey: !!process.env.GEMINI_API_KEY
    });
  }
});

// クライアントにサーバー環境の基本情報を提供（APIキーは含まない）
app.get('/api/server-info', (req, res) => {
  res.json({
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    serverMode: process.env.NODE_ENV || 'development',
    aiConfig: {
      provider: API_PROVIDER,
      defaultModel: AI_MODEL,
      region: GOOGLE_CLOUD_REGION,
      hasVertexAI: !!(GOOGLE_PROJECT_ID && GOOGLE_PRIVATE_KEY && GOOGLE_CLIENT_EMAIL)
    }
  });
}); 