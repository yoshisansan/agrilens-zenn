/**
 * データ初期化機能のテスト
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// モック関数の定義
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
    }),
    clear: jest.fn(function() {
        this.data = {};
    }),
    get length() {
        return Object.keys(this.data).length;
    },
    key: jest.fn(function(index) {
        return Object.keys(this.data)[index] || null;
    })
};

// グローバルオブジェクトのモック
global.window = {
    confirm: jest.fn(),
    alert: jest.fn(),
    map: {
        hasLayer: jest.fn(),
        removeLayer: jest.fn(),
        getCenter: jest.fn(() => ({ lat: 43.336, lng: 141.611 }))
    },
    currentAOILayer: null,
    drawnItems: {
        clearLayers: jest.fn()
    },
    currentFieldId: null,
    currentAOIGeoJSON: null
};

// グローバル関数のモック
global.confirm = jest.fn();
global.alert = jest.fn();

global.CONFIG = {
    FIELDS: {
        STORAGE_KEY: 'hatake_health_fields',
        DEFAULT_COLOR: '#007bff'
    },
    DIRECTORIES: {
        STORAGE_KEY: 'hatake_health_directories'
    }
};

// DOM要素のモック
global.document = {
    getElementById: jest.fn(),
    createElement: jest.fn(() => ({
        id: '',
        className: '',
        classList: {
            add: jest.fn(),
            remove: jest.fn()
        },
        textContent: ''
    })),
    querySelector: jest.fn(),
    addEventListener: jest.fn()
};

// ユーティリティ関数のモック
global.showToast = jest.fn();
global.renderFieldsList = jest.fn();
global.renderDirectoriesList = jest.fn();
global.clearVegetationLayers = jest.fn();
global.updateAnalysisHistorySection = jest.fn();
global.getDirectoriesList = jest.fn();
global.addField = jest.fn(() => ({ id: 'field_1', name: 'サンプル' }));

// テスト対象のファイルを読み込み
const fs = require('fs');
const path = require('path');
const dataInitializerCode = fs.readFileSync(
    path.join(__dirname, '../js/data-initializer.js'),
    'utf8'
);

// グローバルスコープで関数を評価
eval(`
    ${dataInitializerCode}
    
    // 関数をグローバルに公開
    global.convertSvgPathToGeoJSON = convertSvgPathToGeoJSON;
    global.createSampleFieldData = createSampleFieldData;
    global.clearFieldsData = clearFieldsData;
    global.clearDirectoriesData = clearDirectoriesData;
    global.clearAnalysisData = clearAnalysisData;
    global.getStoredFieldsCount = getStoredFieldsCount;
    global.getStoredDirectoriesCount = getStoredDirectoriesCount;
    global.getStoredAnalysisCount = getStoredAnalysisCount;
    global.initializeAllData = initializeAllData;
    global.clearFieldsOnly = clearFieldsOnly;
    global.addSampleField = addSampleField;
`);

describe('データ初期化機能', () => {
    beforeEach(() => {
        // テスト前に localStorage をクリア
        localStorage.clear();
        jest.clearAllMocks();
    });

    afterEach(() => {
        // テスト後にクリーンアップ
        localStorage.clear();
    });

    describe('convertSvgPathToGeoJSON', () => {
        test('有効なSVGパスをGeoJSONに変換する', () => {
            const svgPath = "M300,200 L400,200 L400,300 L300,300 Z";
            const centerLat = 43.336851;
            const centerLng = 141.611141;
            
            const result = convertSvgPathToGeoJSON(svgPath, centerLat, centerLng);
            
            expect(result).not.toBeNull();
            expect(result.type).toBe('Feature');
            expect(result.geometry.type).toBe('Polygon');
            expect(result.geometry.coordinates).toHaveLength(1);
            expect(result.geometry.coordinates[0]).toBeInstanceOf(Array);
        });

        test('無効なSVGパスでnullを返す', () => {
            const invalidPath = "invalid path";
            const centerLat = 43.336851;
            const centerLng = 141.611141;
            
            const result = convertSvgPathToGeoJSON(invalidPath, centerLat, centerLng);
            
            expect(result).toBeNull();
        });

        test('空のSVGパスでnullを返す', () => {
            const emptyPath = "";
            const centerLat = 43.336851;
            const centerLng = 141.611141;
            
            const result = convertSvgPathToGeoJSON(emptyPath, centerLat, centerLng);
            
            expect(result).toBeNull();
        });
    });

    describe('createSampleFieldData', () => {
        test('サンプル圃場データを正しく作成する', () => {
            const sampleData = createSampleFieldData();
            
            expect(sampleData).toHaveProperty('name', 'サンプル');
            expect(sampleData).toHaveProperty('memo', 'シード用のサンプル区画です');
            expect(sampleData).toHaveProperty('crop', '稲');
            expect(sampleData).toHaveProperty('center');
            expect(sampleData).toHaveProperty('geoJSON');
            expect(sampleData).toHaveProperty('color', CONFIG.FIELDS.DEFAULT_COLOR);
            expect(sampleData).toHaveProperty('directoryId', 'directory_default');
            
            expect(sampleData.center).toHaveLength(2);
            expect(sampleData.geoJSON.type).toBe('Feature');
            expect(sampleData.geoJSON.geometry.type).toBe('Polygon');
        });
    });

    describe('clearFieldsData', () => {
        test('圃場データを正常に削除する', () => {
            // 事前データをセット
            localStorage.setItem(CONFIG.FIELDS.STORAGE_KEY, JSON.stringify([{id: 'field1'}]));
            
            clearFieldsData();
            
            expect(localStorage.removeItem).toHaveBeenCalledWith(CONFIG.FIELDS.STORAGE_KEY);
        });

        test('エラーが発生した場合は例外を投げる', () => {
            localStorage.removeItem.mockImplementation(() => {
                throw new Error('Storage error');
            });
            
            expect(() => clearFieldsData()).toThrow('Storage error');
        });
    });

    describe('clearDirectoriesData', () => {
        test('ディレクトリデータを正常に削除する', () => {
            localStorage.setItem(CONFIG.DIRECTORIES.STORAGE_KEY, JSON.stringify([{id: 'dir1'}]));
            
            clearDirectoriesData();
            
            expect(localStorage.removeItem).toHaveBeenCalledWith(CONFIG.DIRECTORIES.STORAGE_KEY);
        });
    });

    describe('clearAnalysisData', () => {
        test('分析結果データを正常に削除する', () => {
            // 事前データをセット
            localStorage.setItem('agrilens_analysis_results', JSON.stringify([]));
            localStorage.setItem('agrilens_analysis_history', JSON.stringify([]));
            localStorage.setItem('agrilens_analysis_settings', JSON.stringify({}));
            
            clearAnalysisData();
            
            expect(localStorage.removeItem).toHaveBeenCalledWith('agrilens_analysis_results');
            expect(localStorage.removeItem).toHaveBeenCalledWith('agrilens_analysis_history');
            expect(localStorage.removeItem).toHaveBeenCalledWith('agrilens_analysis_settings');
        });

        test('AnalysisStorageモジュールがある場合はclearを呼び出す', () => {
            const mockAnalysisStorage = {
                clear: jest.fn()
            };
            global.window.AnalysisStorage = mockAnalysisStorage;
            
            clearAnalysisData();
            
            expect(mockAnalysisStorage.clear).toHaveBeenCalled();
            
            // クリーンアップ
            delete global.window.AnalysisStorage;
        });
    });

    describe('getStoredFieldsCount', () => {
        test('保存された圃場数を正しく取得する', () => {
            const fieldsData = [
                { id: 'field1', name: 'Field 1' },
                { id: 'field2', name: 'Field 2' }
            ];
            localStorage.setItem(CONFIG.FIELDS.STORAGE_KEY, JSON.stringify(fieldsData));
            
            const count = getStoredFieldsCount();
            
            expect(count).toBe(2);
        });

        test('データがない場合は0を返す', () => {
            const count = getStoredFieldsCount();
            
            expect(count).toBe(0);
        });

        test('不正なJSONの場合は0を返す', () => {
            localStorage.setItem(CONFIG.FIELDS.STORAGE_KEY, 'invalid json');
            
            const count = getStoredFieldsCount();
            
            expect(count).toBe(0);
        });
    });

    describe('getStoredDirectoriesCount', () => {
        test('保存されたディレクトリ数を正しく取得する', () => {
            const directoriesData = [{ id: 'dir1' }];
            localStorage.setItem(CONFIG.DIRECTORIES.STORAGE_KEY, JSON.stringify(directoriesData));
            
            const count = getStoredDirectoriesCount();
            
            expect(count).toBe(1);
        });

        test('データがない場合は0を返す', () => {
            const count = getStoredDirectoriesCount();
            
            expect(count).toBe(0);
        });
    });

    describe('getStoredAnalysisCount', () => {
        test('分析履歴数を正しく取得する', () => {
            const historyData = [{ id: 'analysis1' }, { id: 'analysis2' }];
            localStorage.setItem('agrilens_analysis_history', JSON.stringify(historyData));
            
            const count = getStoredAnalysisCount();
            
            expect(count).toBe(2);
        });

        test('AnalysisStorageがある場合はそちらから取得する', () => {
            const mockAnalysisStorage = {
                getHistory: jest.fn(() => [{ id: 'analysis1' }])
            };
            global.window.AnalysisStorage = mockAnalysisStorage;
            
            const count = getStoredAnalysisCount();
            
            expect(count).toBe(1);
            expect(mockAnalysisStorage.getHistory).toHaveBeenCalled();
            
            // クリーンアップ
            delete global.window.AnalysisStorage;
        });

        test('データがない場合は0を返す', () => {
            const count = getStoredAnalysisCount();
            
            expect(count).toBe(0);
        });
    });

    describe('initializeAllData', () => {
        test('ユーザーが確認した場合に初期化を実行する', () => {
            window.confirm.mockReturnValue(true);
            
            const result = initializeAllData();
            
            expect(result).toBe(true);
            expect(window.confirm).toHaveBeenCalled();
            expect(localStorage.removeItem).toHaveBeenCalledWith(CONFIG.FIELDS.STORAGE_KEY);
            expect(localStorage.removeItem).toHaveBeenCalledWith(CONFIG.DIRECTORIES.STORAGE_KEY);
        });

        test('ユーザーがキャンセルした場合は何もしない', () => {
            window.confirm.mockReturnValue(false);
            
            const result = initializeAllData();
            
            expect(result).toBe(false);
            expect(localStorage.removeItem).not.toHaveBeenCalled();
        });

        test('初期化中にエラーが発生した場合はfalseを返す', () => {
            window.confirm.mockReturnValue(true);
            localStorage.removeItem.mockImplementation(() => {
                throw new Error('Storage error');
            });
            
            const result = initializeAllData();
            
            expect(result).toBe(false);
        });
    });

    describe('clearFieldsOnly', () => {
        test('ユーザーが確認した場合に圃場データのみ削除', () => {
            window.confirm.mockReturnValue(true);
            
            const result = clearFieldsOnly();
            
            expect(result).toBe(true);
            expect(window.confirm).toHaveBeenCalled();
            expect(localStorage.removeItem).toHaveBeenCalledWith(CONFIG.FIELDS.STORAGE_KEY);
        });

        test('ユーザーがキャンセルした場合は何もしない', () => {
            window.confirm.mockReturnValue(false);
            
            const result = clearFieldsOnly();
            
            expect(result).toBe(false);
            expect(localStorage.removeItem).not.toHaveBeenCalled();
        });
    });

    describe('addSampleField', () => {
        test('サンプル圃場を正常に追加する', () => {
            addSampleField();
            
            expect(getDirectoriesList).toHaveBeenCalled();
            expect(addField).toHaveBeenCalled();
            
            const callArgs = addField.mock.calls[0][0];
            expect(callArgs).toHaveProperty('name', 'サンプル');
            expect(callArgs).toHaveProperty('crop', '稲');
        });

        test('addField関数が利用できない場合はエラーログを出力', () => {
            const originalAddField = global.addField;
            delete global.addField;
            
            // エラーが投げられないことを確認
            expect(() => addSampleField()).not.toThrow();
            
            // 関数を復元
            global.addField = originalAddField;
        });
    });
});