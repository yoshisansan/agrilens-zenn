/**
 * 分析機能のテスト
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// グローバルオブジェクトのモック
global.fetch = jest.fn();
global.window = {
    map: {
        getCenter: jest.fn(() => ({ lat: 43.336, lng: 141.611 })),
        hasLayer: jest.fn(),
        removeLayer: jest.fn()
    },
    location: { href: '' },
    currentAOILayer: null,
    drawnItems: { clearLayers: jest.fn() },
    currentFieldId: null,
    currentAOIGeoJSON: null
};

global.document = {
    getElementById: jest.fn(() => ({
        classList: {
            add: jest.fn(),
            remove: jest.fn()
        },
        textContent: ''
    }))
};

// ユーティリティ関数のモック
global.showProcessingModal = jest.fn();
global.hideProcessingModal = jest.fn();
global.updateProgressBar = jest.fn();
global.showToast = jest.fn();
global.addVegetationIndicesLayers = jest.fn();
global.clearVegetationLayers = jest.fn();
global.evaluateFieldHealth = jest.fn(() => ({
    vegetation: { status: 'good', value: 0.65 },
    moisture: { status: 'good', value: 0.3 },
    nutrition: { status: 'good', value: 0.2 }
}));
global.updateHealthSummary = jest.fn();
global.updateAiComment = jest.fn();
global.updateDetailedStats = jest.fn();
global.createLocalMockData = jest.fn();
global.analysisResultsEl = {
    classList: {
        add: jest.fn(),
        remove: jest.fn()
    }
};

// テスト対象のファイルから必要な関数を読み込み
const fs = require('fs');
const path = require('path');
const analysisCode = fs.readFileSync(
    path.join(__dirname, '../js/analysis.js'),
    'utf8'
);

// 必要な関数のみを抽出してグローバルに公開
eval(`
    ${analysisCode}
    
    // 関数をグローバルに公開
    global.fetchGEEAnalysis = fetchGEEAnalysis;
    global.processIndicesStats = processIndicesStats;
    global.displayAnalysisResults = displayAnalysisResults;
`);

describe('分析機能', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // fetch のモックレスポンスをリセット
        fetch.mockClear();
    });

    describe('processIndicesStats', () => {
        test('GEEからの統計データを正しく整形する', () => {
            const rawStats = {
                'NDVI_mean': 0.65,
                'NDVI_stdDev': 0.1,
                'NDVI_min': 0.3,
                'NDVI_max': 0.9,
                'NDMI_mean': 0.3,
                'NDMI_stdDev': 0.05,
                'NDRE_mean': 0.2,
                'NDRE_stdDev': 0.03
            };
            
            const result = processIndicesStats(rawStats);
            
            expect(result).toHaveProperty('ndvi');
            expect(result).toHaveProperty('ndmi');
            expect(result).toHaveProperty('ndre');
            
            expect(result.ndvi).toEqual({
                mean: 0.65,
                stdDev: 0.1,
                min: 0.3,
                max: 0.9
            });
            
            expect(result.ndmi).toEqual({
                mean: 0.3,
                stdDev: 0.05
            });
            
            expect(result.ndre).toEqual({
                mean: 0.2,
                stdDev: 0.03
            });
        });

        test('データがない場合は空のオブジェクトを返す', () => {
            const result = processIndicesStats(null);
            
            expect(result).toEqual({
                ndvi: {},
                ndmi: {},
                ndre: {}
            });
        });

        test('無効なキー形式は無視される', () => {
            const rawStats = {
                'NDVI_mean': 0.65,
                'invalid_key': 0.5,
                'NDMI': 0.3, // アンダースコアなし
                'NDRE_stdDev': 0.03
            };
            
            const result = processIndicesStats(rawStats);
            
            expect(result.ndvi).toEqual({ mean: 0.65 });
            expect(result.ndmi).toEqual({});
            expect(result.ndre).toEqual({ stdDev: 0.03 });
        });
    });

    describe('fetchGEEAnalysis', () => {
        test('正常なGeoJSONデータで分析を実行する', async () => {
            const mockGeoJSON = {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[141.611, 43.336], [141.612, 43.336], [141.612, 43.337], [141.611, 43.337], [141.611, 43.336]]]
                }
            };
            
            const mockResponse = {
                stats: {
                    'NDVI_mean': 0.65,
                    'NDMI_mean': 0.3,
                    'NDRE_mean': 0.2
                },
                dateRange: { start: '2024-01-01', end: '2024-01-31' }
            };
            
            fetch.mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(mockResponse)
            });
            
            const result = await fetchGEEAnalysis(mockGeoJSON);
            
            expect(fetch).toHaveBeenCalledWith('/api/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ aoiGeoJSON: mockGeoJSON.geometry })
            });
            
            expect(result).toEqual(mockResponse);
            expect(showProcessingModal).toHaveBeenCalled();
            expect(hideProcessingModal).toHaveBeenCalled();
            expect(updateProgressBar).toHaveBeenCalled();
        });

        test('GeoJSONがない場合はエラーを投げる', async () => {
            await expect(fetchGEEAnalysis(null)).rejects.toThrow('GeoJSONデータがありません');
            expect(hideProcessingModal).toHaveBeenCalled();
        });

        test('無効な座標データの場合はエラーを投げる', async () => {
            const invalidGeoJSON = {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: null
                }
            };
            
            await expect(fetchGEEAnalysis(invalidGeoJSON)).rejects.toThrow('座標データがないか無効です');
            expect(hideProcessingModal).toHaveBeenCalled();
        });

        test('APIエラーレスポンスの場合は適切にエラーを処理する', async () => {
            const mockGeoJSON = {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[141.611, 43.336], [141.612, 43.336], [141.612, 43.337], [141.611, 43.337], [141.611, 43.336]]]
                }
            };
            
            fetch.mockResolvedValue({
                ok: false,
                status: 500,
                json: jest.fn().mockResolvedValue({
                    error: 'Internal Server Error',
                    details: 'Database connection failed'
                })
            });
            
            await expect(fetchGEEAnalysis(mockGeoJSON)).rejects.toThrow('Internal Server Error');
            expect(hideProcessingModal).toHaveBeenCalled();
            expect(showToast).toHaveBeenCalledWith(
                "エラーが発生しました",
                "Internal Server Error\nDatabase connection failed"
            );
        });

        test('認証エラーの場合は認証ページにリダイレクト', async () => {
            const mockGeoJSON = {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[141.611, 43.336], [141.612, 43.336], [141.612, 43.337], [141.611, 43.337], [141.611, 43.336]]]
                }
            };
            
            fetch.mockResolvedValue({
                ok: false,
                status: 401,
                json: jest.fn().mockResolvedValue({
                    error: 'Unauthorized'
                })
            });
            
            await fetchGEEAnalysis(mockGeoJSON);
            
            expect(window.location.href).toBe('/auth');
            expect(hideProcessingModal).toHaveBeenCalled();
        });

        test('ネットワークエラーの場合は適切にエラーを処理する', async () => {
            const mockGeoJSON = {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[141.611, 43.336], [141.612, 43.336], [141.612, 43.337], [141.611, 43.337], [141.611, 43.336]]]
                }
            };
            
            fetch.mockRejectedValue(new Error('Network error'));
            
            await expect(fetchGEEAnalysis(mockGeoJSON)).rejects.toThrow('Network error');
            expect(hideProcessingModal).toHaveBeenCalled();
            expect(showToast).toHaveBeenCalledWith(
                "エラーが発生しました",
                "GEE分析中にエラーが発生しました: Network error"
            );
        });

        test('認証関連エラーの場合はモックデータを使用する', async () => {
            const mockGeoJSON = {
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [[[141.611, 43.336], [141.612, 43.336], [141.612, 43.337], [141.611, 43.337], [141.611, 43.336]]]
                }
            };
            
            const mockData = { mockData: true };
            createLocalMockData.mockReturnValue(mockData);
            
            fetch.mockRejectedValue(new Error('authentication credential failed'));
            
            const result = await fetchGEEAnalysis(mockGeoJSON);
            
            expect(result).toEqual(mockData);
            expect(createLocalMockData).toHaveBeenCalledWith(mockGeoJSON);
            expect(showToast).toHaveBeenCalledWith(
                "認証エラー",
                "Google Earth Engineへの認証に失敗しました。モックデータを使用します。"
            );
        });
    });

    describe('displayAnalysisResults', () => {
        test('分析結果を正しく表示する', () => {
            const mockData = {
                stats: {
                    'NDVI_mean': 0.65,
                    'NDVI_stdDev': 0.1,
                    'NDMI_mean': 0.3,
                    'NDMI_stdDev': 0.05,
                    'NDRE_mean': 0.2,
                    'NDRE_stdDev': 0.03
                },
                dateRange: { start: '2024-01-01', end: '2024-01-31' },
                ndviTileUrlTemplate: 'https://example.com/ndvi/{z}/{x}/{y}',
                ndmiTileUrlTemplate: 'https://example.com/ndmi/{z}/{x}/{y}',
                ndreTileUrlTemplate: 'https://example.com/ndre/{z}/{x}/{y}'
            };
            
            displayAnalysisResults(mockData);
            
            expect(addVegetationIndicesLayers).toHaveBeenCalledWith(mockData);
            expect(evaluateFieldHealth).toHaveBeenCalled();
            expect(updateHealthSummary).toHaveBeenCalled();
            expect(updateAiComment).toHaveBeenCalled();
            expect(updateDetailedStats).toHaveBeenCalled();
        });

        test('分析結果パネルの表示制御が正しく動作する', () => {
            const mockData = {
                stats: {
                    'NDVI_mean': 0.65
                },
                dateRange: { start: '2024-01-01', end: '2024-01-31' }
            };
            
            // analysisResultsElのモック
            global.analysisResultsEl = {
                classList: {
                    add: jest.fn(),
                    remove: jest.fn()
                }
            };
            
            displayAnalysisResults(mockData);
            
            expect(analysisResultsEl.classList.add).toHaveBeenCalledWith('hidden');
            
            // setTimeoutの実行をシミュレート
            setTimeout(() => {
                expect(analysisResultsEl.classList.remove).toHaveBeenCalledWith('hidden');
            }, 50);
        });

        test('生成時刻の更新が正しく行われる', () => {
            const mockTimeElement = {
                textContent: ''
            };
            
            document.getElementById.mockImplementation((id) => {
                if (id === 'analysisGeneratedTime') {
                    return mockTimeElement;
                }
                return {
                    classList: { add: jest.fn(), remove: jest.fn() },
                    textContent: ''
                };
            });
            
            const mockData = {
                stats: { 'NDVI_mean': 0.65 },
                dateRange: { start: '2024-01-01', end: '2024-01-31' }
            };
            
            displayAnalysisResults(mockData);
            
            expect(mockTimeElement.textContent).toMatch(/生成時刻: /);
        });
    });

    describe('エラーハンドリング', () => {
        test('processIndicesStatsで無効なデータを処理する', () => {
            const invalidData = 'invalid string data';
            
            expect(() => processIndicesStats(invalidData)).not.toThrow();
            
            const result = processIndicesStats(invalidData);
            expect(result).toEqual({
                ndvi: {},
                ndmi: {},
                ndre: {}
            });
        });

        test('displayAnalysisResultsで欠損データを処理する', () => {
            const incompleteData = {
                stats: null,
                dateRange: null
            };
            
            expect(() => displayAnalysisResults(incompleteData)).not.toThrow();
            expect(addVegetationIndicesLayers).toHaveBeenCalledWith(incompleteData);
        });
    });
});