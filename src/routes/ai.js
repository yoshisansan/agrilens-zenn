const express = require('express');
const router = express.Router();

// コントローラー
const aiController = require('../controllers/aiController');

// ミドルウェア
const { aiRateLimit } = require('../middleware/rateLimit');
const { validatePrompt, handleValidationErrors } = require('../middleware/validation');
const { optionalAuthentication } = require('../middleware/auth');

// AI アドバイス生成
router.post('/advice', 
    aiRateLimit,
    optionalAuthentication,
    validatePrompt,
    handleValidationErrors,
    aiController.generateAdvice
);

// AI アドバイス生成（後方互換性用）
router.post('/gemini-advice',
    aiRateLimit,
    optionalAuthentication,
    validatePrompt,
    handleValidationErrors,
    aiController.generateAdvice
);

// AI API テスト
router.get('/test',
    aiController.testGeminiAPI
);

// Gemini API テスト（後方互換性用）
router.get('/gemini-test',
    aiController.testGeminiAPI
);

// AI サービスヘルスチェック
router.get('/health',
    aiController.healthCheck
);

// サーバー情報取得
router.get('/server-info',
    aiController.getServerInfo
);

// 利用可能なモデル一覧
router.get('/models',
    aiController.getAvailableModels
);

// 使用統計（将来の機能）
router.get('/stats',
    optionalAuthentication,
    aiController.getUsageStats
);

module.exports = router;