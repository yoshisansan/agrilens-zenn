// グローバル設定
const CONFIG = {
    // マップ表示の設定
    MAP: {
        CENTER: [35.089915, 138.898154], // 静岡県富士宮市付近（テスト用）
        ZOOM: 16,
        TILE_URL: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        SATELLITE_TILE_URL: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        SATELLITE_ATTRIBUTION: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    },
    
    // NDVIの閾値設定
    NDVI: {
        GOOD: 0.6, // 良好な植生
        MODERATE: 0.4, // 中程度の植生
        MIN_GOOD: 0.5, // 最小値としての良好
        MIN_MODERATE: 0.3 // 最小値としての中程度
    },
    
    // NDMIの閾値設定（水分ストレス）
    NDMI: {
        GOOD: 0.3, // 良好な水分状態
        MODERATE: 0.1, // 中程度の水分状態
        MIN_GOOD: 0.2, // 最小値としての良好
        MIN_MODERATE: 0.05 // 最小値としての中程度
    },
    
    // NDREの閾値設定（栄養状態）
    NDRE: {
        GOOD: 0.2, // 良好な栄養状態
        MODERATE: 0.1, // 中程度の栄養状態
        MIN_GOOD: 0.15, // 最小値としての良好
        MIN_MODERATE: 0.05 // 最小値としての中程度
    },
    
    // 標準偏差の閾値
    STD_DEV: {
        LOW: 0.05, // 低い変動
        MODERATE: 0.1 // 中程度の変動
    },
    
    // 分析の設定
    ANALYSIS: {
        MAX_AREA_SIZE: 1000000, // 最大分析面積（平方メートル）
        MAX_ANALYSIS_COUNT: 5, // 一日あたりの最大分析回数
        DEFAULT_DATE_RANGE: 30 // 直近の日数（デフォルト）
    },

    // シミュレーション設定
    SIMULATION: {
        PROGRESS_INTERVAL: 400, // ms
        LOADING_DELAY: 1500, // ms
        PROGRESS_MAX: 90 // %
    },

    // GEE設定
    GEE: {
        // Sentinel-2のバンド設定
        SENTINEL2: {
            RED_BAND: 'B4',    // 赤バンド
            NIR_BAND: 'B8',    // 近赤外バンド
            RED_EDGE_BAND: 'B5', // レッドエッジバンド (NDRE用)
            SWIR1_BAND: 'B11',   // 短波長赤外バンド (NDMI用)
            CLOUD_COVER: 20,   // 最大雲量（%）
            SCALE: 10,         // 解像度（m）
            START_DATE: '2024-01-01',  // 開始日
            END_DATE: '2024-12-31'     // 終了日
        },
        // 植生指標の表示設定
        NDVI: {
            MIN: -1,
            MAX: 1,
            PALETTE: ['#d01c11', '#f1b543', '#4dac26']  // 赤、黄、緑
        },
        NDMI: {
            MIN: -1,
            MAX: 1,
            PALETTE: ['#d01c11', '#f1b543', '#4287f5']  // 赤、黄、青
        },
        NDRE: {
            MIN: -1,
            MAX: 1,
            PALETTE: ['#d01c11', '#f1b543', '#4dac26']  // 赤、黄、緑
        }
    },
    
    // 区画管理の設定
    FIELDS: {
        MAX_FIELDS: 50, // ユーザーあたりの最大区画数
        STORAGE_KEY: 'hatake_health_fields', // ローカルストレージのキー
        DEFAULT_COLOR: '#3b82f6' // デフォルトの区画ポリゴン色
    },
    
    // リスト（ディレクトリ）管理の設定
    DIRECTORIES: {
        MAX_DIRECTORIES: 10, // ユーザーあたりの最大リスト数
        STORAGE_KEY: 'hatake_health_directories', // ローカルストレージのキー
        DEFAULT_NAME: '圃場1' // デフォルトリスト名
    },
    
    // APIとタイムアウト設定
    API: {
        GEMINI_TIMEOUT: 30000, // Gemini APIタイムアウト（ms）
        RETRY_COUNT: 3, // リトライ回数
        RETRY_DELAY: 1000 // リトライ間隔（ms）
    },
    
    // UI設定
    UI: {
        PANEL_ANIMATION_DELAY: 50, // パネル表示遅延（ms）
        PROGRESS_UPDATE_DELAY: 100, // プログレスバー更新間隔（ms）
        LOADING_SPINNER_DELAY: 200, // ローディング表示遅延（ms）
        DEFAULT_DECIMAL_PLACES: 3 // デフォルト小数点以下桁数
    },
    
    // デフォルト値設定
    DEFAULTS: {
        NDVI_VALUE: 0.65,
        NDMI_VALUE: 0.42,
        NDRE_VALUE: 0.38,
        CROP_TYPE: '不明'
    }
}; 