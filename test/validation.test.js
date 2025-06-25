/**
 * NDVI検証機能のテスト
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// グローバルオブジェクトのモック
global.window = {
    map: {
        getCenter: jest.fn(() => ({ lat: 43.336, lng: 141.611 })),
        hasLayer: jest.fn(),
        removeLayer: jest.fn()
    },
    lastAnalysisResult: null,
    AnalysisStorage: null,
    addEventListener: jest.fn(),
    location: { href: '' }
};

global.document = {
    getElementById: jest.fn(),
    createElement: jest.fn(() => ({
        id: '',
        className: '',
        classList: {
            add: jest.fn(),
            remove: jest.fn()
        },
        innerHTML: '',
        textContent: '',
        parentNode: {
            insertBefore: jest.fn()
        },
        nextSibling: null
    })),
    querySelector: jest.fn(),
    addEventListener: jest.fn()
};

global.localStorage = {
    data: {},
    getItem: jest.fn(function(key) {
        return this.data[key] || null;
    }),
    setItem: jest.fn(function(key, value) {
        this.data[key] = value;
    }),
    removeItem: jest.fn(function(key) {
        delete this.data[key];
    })
};

// ユーティリティ関数のモック
global.showToast = jest.fn();
global.fetch = jest.fn();
global.Promise = Promise;
global.Date = Date;

// テスト対象のファイルを読み込み
const fs = require('fs');
const path = require('path');
const validationCode = fs.readFileSync(
    path.join(__dirname, '../js/validation.js'),
    'utf8'
);

// グローバルスコープで関数を評価
eval(`
    ${validationCode}
    
    // 関数をグローバルに公開
    global.getMockReferenceData = getMockReferenceData;
    global.getSeasonalFactor = getSeasonalFactor;
    global.generateMockTimeSeriesData = generateMockTimeSeriesData;
    global.compareWithReference = compareWithReference;
    global.generateComparisonSummary = generateComparisonSummary;
    global.getStatusJapanese = getStatusJapanese;
    global.fetchReferenceNdviData = fetchReferenceNdviData;
    global.displayValidationResults = displayValidationResults;
`);

describe('NDVI検証機能', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.data = {};
        
        // DOM要素のモックをリセット
        document.getElementById.mockReturnValue({
            id: 'mockElement',
            className: '',
            classList: {
                add: jest.fn(),
                remove: jest.fn()
            },
            innerHTML: '',
            textContent: '',
            disabled: false
        });
    });

    afterEach(() => {
        localStorage.data = {};
    });

    describe('getMockReferenceData', () => {
        test('モックリファレンスデータを正しく生成する', async () => {
            const lat = 43.336851;
            const lon = 141.611141;
            const startDate = '2024-01-01';
            const endDate = '2024-01-31';
            
            const result = await getMockReferenceData(lat, lon, startDate, endDate);
            
            expect(result).toHaveProperty('source', 'REFERENCE_DB');
            expect(result).toHaveProperty('sourceFullName', 'リファレンスデータベース');
            expect(result).toHaveProperty('location');
            expect(result.location).toEqual({ lat, lon });
            expect(result).toHaveProperty('dateRange');
            expect(result.dateRange).toEqual({ start: startDate, end: endDate });
            expect(result).toHaveProperty('cropType');
            expect(result).toHaveProperty('ndviValues');
            expect(result).toHaveProperty('average');
            expect(result).toHaveProperty('reliability', 'medium');
            expect(result).toHaveProperty('note');
            
            expect(Array.isArray(result.ndviValues)).toBe(true);
            expect(result.ndviValues.length).toBeGreaterThan(0);
            expect(typeof result.average).toBe('number');
        });

        test('作物タイプに基づいて適切なNDVI値を生成する', async () => {
            const lat = 43.0; // 稲になるような座標
            const lon = 141.0;
            const startDate = '2024-06-01';
            const endDate = '2024-06-30';
            
            const result = await getMockReferenceData(lat, lon, startDate, endDate);
            
            expect(['rice', 'wheat', 'soybean', 'vegetables']).toContain(result.cropType);
            expect(result.average).toBeGreaterThan(0);
            expect(result.average).toBeLessThan(1);
        });
    });

    describe('getSeasonalFactor', () => {
        test('稲の季節係数を正しく計算する', () => {
            const riceFactorJune = getSeasonalFactor(5, 'rice'); // 6月（インデックス5）
            const riceFactorJanuary = getSeasonalFactor(0, 'rice'); // 1月（インデックス0）
            
            expect(riceFactorJune).toBe(0.9); // 成長期
            expect(riceFactorJanuary).toBe(0.3); // 休眠期
        });

        test('小麦の季節係数を正しく計算する', () => {
            const wheatFactorMarch = getSeasonalFactor(2, 'wheat'); // 3月
            const wheatFactorJuly = getSeasonalFactor(6, 'wheat'); // 7月
            
            expect(wheatFactorMarch).toBe(1.0); // 成長期
            expect(wheatFactorJuly).toBe(0.5); // 収穫後
        });

        test('未知の作物タイプはデフォルト係数を使用', () => {
            const unknownCropFactor = getSeasonalFactor(5, 'unknown_crop');
            const defaultFactor = getSeasonalFactor(5, 'default');
            
            expect(unknownCropFactor).toBe(defaultFactor);
        });
    });

    describe('generateMockTimeSeriesData', () => {
        test('指定期間の時系列データを生成する', () => {
            const startDate = '2024-01-01';
            const endDate = '2024-01-15';
            const baseMean = 0.65;
            const variability = 0.1;
            
            const result = generateMockTimeSeriesData(startDate, endDate, baseMean, variability);
            
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            
            result.forEach(item => {
                expect(item).toHaveProperty('date');
                expect(item).toHaveProperty('ndvi');
                expect(typeof item.date).toBe('string');
                expect(typeof item.ndvi).toBe('string');
                
                const ndviValue = parseFloat(item.ndvi);
                expect(ndviValue).toBeGreaterThanOrEqual(0);
                expect(ndviValue).toBeLessThanOrEqual(1);
            });
        });

        test('長期間の場合は最大30サンプルに制限される', () => {
            const startDate = '2024-01-01';
            const endDate = '2024-12-31'; // 1年間
            const baseMean = 0.65;
            const variability = 0.1;
            
            const result = generateMockTimeSeriesData(startDate, endDate, baseMean, variability);
            
            expect(result.length).toBeLessThanOrEqual(30);
        });
    });

    describe('compareWithReference', () => {
        const mockMeasuredData = {
            stats: {
                mean: 0.65
            }
        };

        const mockReferenceData = [
            {
                sourceFullName: '農研機構データ',
                average: 0.64,
                reliability: 'high',
                cropType: 'rice'
            },
            {
                sourceFullName: 'Copernicus Global Land Service',
                average: 0.59,
                reliability: 'medium',
                cropType: 'unknown'
            }
        ];

        test('測定値とリファレンス値を正しく比較する', () => {
            const result = compareWithReference(mockMeasuredData, mockReferenceData);
            
            expect(result).toHaveProperty('comparisonResults');
            expect(result).toHaveProperty('summary');
            expect(Array.isArray(result.comparisonResults)).toBe(true);
            expect(result.comparisonResults).toHaveLength(2);
            
            const firstComparison = result.comparisonResults[0];
            expect(firstComparison).toHaveProperty('referenceName', '農研機構データ');
            expect(firstComparison).toHaveProperty('referenceValue', 0.64);
            expect(firstComparison).toHaveProperty('measuredValue', 0.65);
            expect(firstComparison).toHaveProperty('absoluteDifference');
            expect(firstComparison).toHaveProperty('percentageDifference');
            expect(firstComparison).toHaveProperty('status');
            expect(firstComparison).toHaveProperty('isWithinTolerance');
        });

        test('信頼性に基づいて許容差異を調整する', () => {
            const result = compareWithReference(mockMeasuredData, mockReferenceData);
            
            const highReliabilityResult = result.comparisonResults[0];
            const mediumReliabilityResult = result.comparisonResults[1];
            
            expect(highReliabilityResult.toleranceThreshold).toBe(10); // 高信頼性
            expect(mediumReliabilityResult.toleranceThreshold).toBe(15); // 中信頼性
        });

        test('差異に基づいてステータスを正しく判定する', () => {
            const closeMatch = [{
                sourceFullName: 'テストデータ',
                average: 0.651, // 0.15%の差異
                reliability: 'high',
                cropType: 'test'
            }];
            
            const result = compareWithReference(mockMeasuredData, closeMatch);
            const comparison = result.comparisonResults[0];
            
            expect(comparison.status).toBe('excellent'); // 許容値の50%以下
            expect(comparison.isWithinTolerance).toBe(true);
        });

        test('大きな差異の場合は適切なステータスを返す', () => {
            const poorMatch = [{
                sourceFullName: 'テストデータ',
                average: 0.5, // 23%の差異
                reliability: 'high',
                cropType: 'test'
            }];
            
            const result = compareWithReference(mockMeasuredData, poorMatch);
            const comparison = result.comparisonResults[0];
            
            expect(comparison.status).toBe('poor');
            expect(comparison.isWithinTolerance).toBe(false);
        });
    });

    describe('generateComparisonSummary', () => {
        test('比較結果の要約を正しく生成する', () => {
            const mockResults = [
                { status: 'excellent', isWithinTolerance: true },
                { status: 'good', isWithinTolerance: true },
                { status: 'poor', isWithinTolerance: false }
            ];
            
            const summary = generateComparisonSummary(mockResults);
            
            expect(summary).toHaveProperty('overallStatus');
            expect(summary).toHaveProperty('matchPercentage');
            expect(summary).toHaveProperty('summaryMessage');
            expect(summary).toHaveProperty('referencesCount', 3);
            
            expect(summary.matchPercentage).toBe('67'); // 2/3 = 66.67% → 67%
        });

        test('全て一致する場合のメッセージ', () => {
            const mockResults = [
                { status: 'excellent', isWithinTolerance: true },
                { status: 'good', isWithinTolerance: true }
            ];
            
            const summary = generateComparisonSummary(mockResults);
            
            expect(summary.matchPercentage).toBe('100');
            expect(summary.summaryMessage).toContain('高い一致');
        });

        test('一致率が低い場合のメッセージ', () => {
            const mockResults = [
                { status: 'poor', isWithinTolerance: false },
                { status: 'poor', isWithinTolerance: false },
                { status: 'good', isWithinTolerance: true }
            ];
            
            const summary = generateComparisonSummary(mockResults);
            
            expect(summary.matchPercentage).toBe('33');
            expect(summary.summaryMessage).toContain('大きく異なります');
        });
    });

    describe('getStatusJapanese', () => {
        test('ステータスの日本語変換を正しく行う', () => {
            expect(getStatusJapanese('excellent')).toBe('優良');
            expect(getStatusJapanese('good')).toBe('良好');
            expect(getStatusJapanese('questionable')).toBe('要確認');
            expect(getStatusJapanese('poor')).toBe('不一致');
            expect(getStatusJapanese('unknown')).toBe('不明');
            expect(getStatusJapanese('invalid')).toBe('不明');
        });
    });

    describe('fetchReferenceNdviData', () => {
        test('複数のデータソースから並行してデータを取得する', async () => {
            // Promiseのモック
            global.Promise.allSettled = jest.fn(() => Promise.resolve([
                { status: 'fulfilled', value: { source: 'NARO', average: 0.64 } },
                { status: 'fulfilled', value: { source: 'COPERNICUS', average: 0.59 } },
                { status: 'fulfilled', value: { source: 'REFERENCE_DB', average: 0.62 } }
            ]));
            
            const lat = 43.336851;
            const lon = 141.611141;
            const startDate = '2024-01-01';
            const endDate = '2024-01-31';
            
            const result = await fetchReferenceNdviData(lat, lon, startDate, endDate);
            
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
            expect(showToast).toHaveBeenCalledWith("検証データ取得中", "参照データを取得しています...");
        });

        test('エラー時はモックデータを返す', async () => {
            // Promise.allSettledがエラーを投げるようにモック
            global.Promise.allSettled = jest.fn(() => Promise.reject(new Error('Network error')));
            
            const lat = 43.336851;
            const lon = 141.611141;
            const startDate = '2024-01-01';
            const endDate = '2024-01-31';
            
            const result = await fetchReferenceNdviData(lat, lon, startDate, endDate);
            
            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('source', 'REFERENCE_DB');
        });
    });

    describe('displayValidationResults', () => {
        test('検証結果を正しく表示する', () => {
            const mockComparisonData = {
                summary: {
                    overallStatus: 'good',
                    matchPercentage: '80',
                    summaryMessage: 'テストサマリー',
                    referencesCount: 2
                },
                comparisonResults: [
                    {
                        referenceName: 'テストデータ1',
                        cropType: 'rice',
                        referenceValue: 0.64,
                        measuredValue: 0.65,
                        percentageDifference: '1.5',
                        status: 'excellent'
                    }
                ]
            };
            
            const mockElement = {
                innerHTML: '',
                classList: {
                    add: jest.fn(),
                    remove: jest.fn()
                },
                parentNode: {
                    insertBefore: jest.fn()
                }
            };
            
            document.getElementById.mockReturnValue(mockElement);
            document.querySelector.mockReturnValue({
                parentNode: {
                    insertBefore: jest.fn()
                }
            });
            
            displayValidationResults(mockComparisonData);
            
            expect(showToast).toHaveBeenCalledWith("検証完了", "リファレンスデータとの比較が完了しました");
            expect(mockElement.innerHTML).toContain('NDVI検証結果');
            expect(mockElement.innerHTML).toContain('テストデータ1');
            expect(mockElement.innerHTML).toContain('rice');
            expect(mockElement.classList.remove).toHaveBeenCalledWith('hidden');
        });
    });
});