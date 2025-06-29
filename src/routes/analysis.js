const express = require('express');
const router = express.Router();

// コントローラー
const analysisController = require('../controllers/analysisController');

// ミドルウェア
const { analysisRateLimit } = require('../middleware/rateLimit');
const { validateGeoJSON, handleValidationErrors } = require('../middleware/validation');
const { optionalAuthentication } = require('../middleware/auth');

// 植生指標分析
router.post('/',
    analysisRateLimit,
    optionalAuthentication,
    validateGeoJSON,
    handleValidationErrors,
    analysisController.analyzeVegetation
);

// 分析エリアの検証
router.post('/validate-area',
    validateGeoJSON,
    handleValidationErrors,
    analysisController.validateAnalysisArea
);

// データ利用可能性チェック
router.post('/data-availability',
    validateGeoJSON,
    handleValidationErrors,
    analysisController.checkDataAvailability
);

// 認証ステータス（後方互換性用）
router.get('/auth-status',
    analysisController.getAuthStatus
);

// サーバー設定情報
router.get('/server-config',
    analysisController.getServerConfig
);

// 分析履歴（将来の機能）
router.get('/history',
    optionalAuthentication,
    analysisController.getAnalysisHistory
);

module.exports = router;