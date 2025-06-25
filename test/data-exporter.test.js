/**
 * データエクスポート機能のテスト
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// グローバルオブジェクトのモック
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

global.window = {
    DATA_EXPORTER: null
};

global.document = {
    createElement: jest.fn(() => ({
        href: '',
        download: '',
        click: jest.fn()
    })),
    body: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
    }
};

global.URL = {
    createObjectURL: jest.fn(() => 'mock-url'),
    revokeObjectURL: jest.fn()
};

global.Blob = jest.fn((content, options) => ({
    content,
    options,
    type: options.type
}));

global.CONFIG = {
    FIELDS: {
        STORAGE_KEY: 'hatake_health_fields'
    },
    DIRECTORIES: {
        STORAGE_KEY: 'hatake_health_directories'
    }
};

global.console = {
    log: jest.fn(),
    error: jest.fn()
};

global.setTimeout = jest.fn((callback, delay) => {
    callback();
    return 1;
});

// テスト対象のファイルを読み込み
const fs = require('fs');
const path = require('path');
const dataExporterCode = fs.readFileSync(
    path.join(__dirname, '../js/data-exporter.js'),
    'utf8'
);
eval(dataExporterCode);

describe('データエクスポート機能', () => {
    let DATA_EXPORTER;

    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.data = {};
        
        // テスト用のサンプルデータを設定
        localStorage.data['hatake_health_fields'] = JSON.stringify([
            { id: 'field1', name: 'Field 1', crop: 'rice' },
            { id: 'field2', name: 'Field 2', crop: 'wheat' }
        ]);
        localStorage.data['hatake_health_directories'] = JSON.stringify([
            { id: 'dir1', name: 'Directory 1' }
        ]);
        localStorage.data['aiQuestionHistory'] = JSON.stringify([
            { id: 1, question: 'Test question', answer: 'Test answer' }
        ]);
        localStorage.data['savedFields'] = JSON.stringify([
            { id: 'saved1', name: 'Saved Field 1' }
        ]);
        localStorage.data['otherData'] = 'Some other data';
        
        // DATA_EXPORTERオブジェクトを取得
        DATA_EXPORTER = window.DATA_EXPORTER;
    });

    afterEach(() => {
        localStorage.data = {};
    });

    describe('getAllStorageKeys', () => {
        test('すべてのローカルストレージキーを取得する', () => {
            const keys = DATA_EXPORTER.getAllStorageKeys();
            
            expect(Array.isArray(keys)).toBe(true);
            expect(keys).toContain('hatake_health_fields');
            expect(keys).toContain('hatake_health_directories');
            expect(keys).toContain('aiQuestionHistory');
            expect(keys).toContain('savedFields');
            expect(keys).toContain('otherData');
            expect(keys).toHaveLength(5);
        });

        test('ローカルストレージが空の場合は空配列を返す', () => {
            localStorage.data = {};
            
            const keys = DATA_EXPORTER.getAllStorageKeys();
            
            expect(keys).toEqual([]);
        });
    });

    describe('getStorageData', () => {
        test('JSONデータを正しく取得・パースする', () => {
            const data = DATA_EXPORTER.getStorageData('hatake_health_fields');
            
            expect(Array.isArray(data)).toBe(true);
            expect(data).toHaveLength(2);
            expect(data[0]).toEqual({ id: 'field1', name: 'Field 1', crop: 'rice' });
        });

        test('文字列データをそのまま返す', () => {
            const data = DATA_EXPORTER.getStorageData('otherData');
            
            expect(data).toBe('Some other data');
        });

        test('存在しないキーに対してnullを返す', () => {
            const data = DATA_EXPORTER.getStorageData('nonexistent');
            
            expect(data).toBeNull();
        });

        test('無効なJSONデータは文字列として返す', () => {
            localStorage.data['invalidJson'] = '{invalid json}';
            
            const data = DATA_EXPORTER.getStorageData('invalidJson');
            
            expect(data).toBe('{invalid json}');
        });
    });

    describe('getAllStorageData', () => {
        test('すべてのストレージデータを取得する', () => {
            const allData = DATA_EXPORTER.getAllStorageData();
            
            expect(typeof allData).toBe('object');
            expect(allData).toHaveProperty('hatake_health_fields');
            expect(allData).toHaveProperty('hatake_health_directories');
            expect(allData).toHaveProperty('aiQuestionHistory');
            expect(allData).toHaveProperty('savedFields');
            expect(allData).toHaveProperty('otherData');
            
            expect(Array.isArray(allData.hatake_health_fields)).toBe(true);
            expect(allData.otherData).toBe('Some other data');
        });

        test('空のローカルストレージからは空オブジェクトを返す', () => {
            localStorage.data = {};
            
            const allData = DATA_EXPORTER.getAllStorageData();
            
            expect(allData).toEqual({});
        });
    });

    describe('getSpecificStorageData', () => {
        test('指定されたキーのデータのみを取得する', () => {
            const keyList = ['hatake_health_fields', 'aiQuestionHistory', 'nonexistent'];
            const specificData = DATA_EXPORTER.getSpecificStorageData(keyList);
            
            expect(specificData).toHaveProperty('hatake_health_fields');
            expect(specificData).toHaveProperty('aiQuestionHistory');
            expect(specificData).not.toHaveProperty('hatake_health_directories');
            expect(specificData).not.toHaveProperty('nonexistent');
            expect(specificData).not.toHaveProperty('otherData');
            
            expect(Array.isArray(specificData.hatake_health_fields)).toBe(true);
            expect(Array.isArray(specificData.aiQuestionHistory)).toBe(true);
        });

        test('存在しないキーは無視される', () => {
            const keyList = ['nonexistent1', 'nonexistent2'];
            const specificData = DATA_EXPORTER.getSpecificStorageData(keyList);
            
            expect(specificData).toEqual({});
        });

        test('空のキーリストでは空オブジェクトを返す', () => {
            const specificData = DATA_EXPORTER.getSpecificStorageData([]);
            
            expect(specificData).toEqual({});
        });
    });

    describe('getHatakeHealthData', () => {
        test('畑ヘルスチェック関連のデータのみを取得する', () => {
            const hatakeData = DATA_EXPORTER.getHatakeHealthData();
            
            expect(hatakeData).toHaveProperty('hatake_health_fields');
            expect(hatakeData).toHaveProperty('hatake_health_directories');
            expect(hatakeData).toHaveProperty('aiQuestionHistory');
            expect(hatakeData).toHaveProperty('savedFields');
            expect(hatakeData).not.toHaveProperty('otherData');
            
            expect(Array.isArray(hatakeData.hatake_health_fields)).toBe(true);
            expect(hatakeData.hatake_health_fields).toHaveLength(2);
        });

        test('アプリ関連データが部分的にない場合も正常に動作する', () => {
            // aiQuestionHistoryを削除
            delete localStorage.data['aiQuestionHistory'];
            
            const hatakeData = DATA_EXPORTER.getHatakeHealthData();
            
            expect(hatakeData).toHaveProperty('hatake_health_fields');
            expect(hatakeData).toHaveProperty('hatake_health_directories');
            expect(hatakeData).not.toHaveProperty('aiQuestionHistory');
            expect(hatakeData).toHaveProperty('savedFields');
        });
    });

    describe('downloadAsJson', () => {
        test('データをJSONファイルとしてダウンロードする', () => {
            const testData = { test: 'data', number: 123 };
            const filename = 'test-file.json';
            
            const mockAnchor = {
                href: '',
                download: '',
                click: jest.fn()
            };
            document.createElement.mockReturnValue(mockAnchor);
            
            DATA_EXPORTER.downloadAsJson(testData, filename);
            
            // Blobが正しく作成されたかチェック
            expect(Blob).toHaveBeenCalledWith(
                [JSON.stringify(testData, null, 2)],
                { type: 'application/json' }
            );
            
            // URLが作成されたかチェック
            expect(URL.createObjectURL).toHaveBeenCalled();
            
            // アンカー要素が正しく設定されたかチェック
            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(mockAnchor.href).toBe('mock-url');
            expect(mockAnchor.download).toBe(filename);
            expect(mockAnchor.click).toHaveBeenCalled();
            
            // DOM操作が正しく行われたかチェック
            expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
            expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
            expect(URL.revokeObjectURL).toHaveBeenCalledWith('mock-url');
        });

        test('ファイル名が指定されない場合はデフォルトファイル名を使用', () => {
            const testData = { test: 'data' };
            
            const mockAnchor = {
                href: '',
                download: '',
                click: jest.fn()
            };
            document.createElement.mockReturnValue(mockAnchor);
            
            DATA_EXPORTER.downloadAsJson(testData);
            
            expect(mockAnchor.download).toBe('hatake-health-data.json');
        });
    });

    describe('exportHatakeHealthData', () => {
        test('畑ヘルスチェックデータをエクスポートする', () => {
            const mockAnchor = {
                href: '',
                download: '',
                click: jest.fn()
            };
            document.createElement.mockReturnValue(mockAnchor);
            
            const result = DATA_EXPORTER.exportHatakeHealthData();
            
            expect(result).toContain('データをエクスポートしました');
            expect(result).toContain('4つのデータセット'); // fields, directories, aiHistory, savedFields
            
            // タイムスタンプ付きファイル名が使用されているかチェック
            expect(mockAnchor.download).toMatch(/hatake-health-backup-.*\.json/);
            
            // ダウンロード処理が実行されたかチェック
            expect(mockAnchor.click).toHaveBeenCalled();
        });

        test('データが空の場合でも正常にエクスポートする', () => {
            localStorage.data = {};
            
            const mockAnchor = {
                href: '',
                download: '',
                click: jest.fn()
            };
            document.createElement.mockReturnValue(mockAnchor);
            
            const result = DATA_EXPORTER.exportHatakeHealthData();
            
            expect(result).toContain('0つのデータセット');
            expect(mockAnchor.click).toHaveBeenCalled();
        });
    });

    describe('importData', () => {
        test('有効なJSONデータをインポートする', () => {
            const testData = {
                'key1': { data: 'value1' },
                'key2': 'string value',
                'key3': [1, 2, 3]
            };
            const jsonString = JSON.stringify(testData);
            
            const result = DATA_EXPORTER.importData(jsonString);
            
            expect(result).toContain('3つのデータセットをインポートしました');
            expect(localStorage.setItem).toHaveBeenCalledWith('key1', JSON.stringify(testData.key1));
            expect(localStorage.setItem).toHaveBeenCalledWith('key2', 'string value');
            expect(localStorage.setItem).toHaveBeenCalledWith('key3', JSON.stringify(testData.key3));
        });

        test('無効なJSONデータに対してエラーメッセージを返す', () => {
            const invalidJson = '{ invalid json }';
            
            const result = DATA_EXPORTER.importData(invalidJson);
            
            expect(result).toBe('無効なJSONデータです');
            expect(localStorage.setItem).not.toHaveBeenCalled();
        });

        test('空のJSONオブジェクトをインポートする', () => {
            const emptyJson = '{}';
            
            const result = DATA_EXPORTER.importData(emptyJson);
            
            expect(result).toContain('0つのデータセットをインポートしました');
        });
    });

    describe('グローバル公開', () => {
        test('DATA_EXPORTERがwindowオブジェクトに公開されている', () => {
            expect(window.DATA_EXPORTER).toBeDefined();
            expect(typeof window.DATA_EXPORTER).toBe('object');
            expect(typeof window.DATA_EXPORTER.exportHatakeHealthData).toBe('function');
            expect(typeof window.DATA_EXPORTER.getAllStorageData).toBe('function');
            expect(typeof window.DATA_EXPORTER.importData).toBe('function');
        });
    });

    describe('エラーハンドリング', () => {
        test('localStorage.getItemでエラーが発生した場合の処理', () => {
            localStorage.getItem.mockImplementation(() => {
                throw new Error('Storage error');
            });
            
            // エラーが発生した場合はnullを返すことを確認
            const result = DATA_EXPORTER.getStorageData('test-key');
            expect(result).toBeNull();
        });

        test('localStorage.setItemでエラーが発生した場合の処理', () => {
            localStorage.setItem.mockImplementation(() => {
                throw new Error('Storage error');
            });
            
            const testData = { key: 'value' };
            const result = DATA_EXPORTER.importData(JSON.stringify(testData));
            
            // エラーメッセージが返されることを確認
            expect(result).toBe('無効なJSONデータです');
        });
    });
});