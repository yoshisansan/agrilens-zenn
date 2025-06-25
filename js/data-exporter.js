/**
 * AgriLens- データエクスポートユーティリティ
 * 
 * このツールはローカルストレージに保存されたデータをエクスポートし、
 * CloudflareへのインポートやバックアップのためにJSONファイルとして
 * ダウンロードする機能を提供します。
 */

(function() {
    // グローバル名前空間を汚染しないようIIFEパターンを使用

    const DATA_EXPORTER = {
        // 保存されているすべてのキーを取得
        getAllStorageKeys: function() {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                keys.push(localStorage.key(i));
            }
            return keys;
        },

        // 指定されたキーのデータを取得
        getStorageData: function(key) {
            try {
                const data = localStorage.getItem(key);
                if (data === null) return null;
                try {
                    return JSON.parse(data);
                } catch (e) {
                    // JSONでない場合は文字列としてそのまま返す
                    return data;
                }
            } catch (e) {
                console.error('Storage access error:', e);
                return null;
            }
        },

        // すべてのストレージデータを取得
        getAllStorageData: function() {
            const data = {};
            const keys = this.getAllStorageKeys();
            
            keys.forEach(key => {
                data[key] = this.getStorageData(key);
            });
            
            return data;
        },

        // 特定のキーリストに基づいたデータのみを取得
        getSpecificStorageData: function(keyList) {
            const data = {};
            
            keyList.forEach(key => {
                if (localStorage.getItem(key) !== null) {
                    data[key] = this.getStorageData(key);
                }
            });
            
            return data;
        },

        // 畑ヘルスチェックアプリの全データを取得
        getHatakeHealthData: function() {
            // 畑ヘルスチェックのキー一覧
            const appKeys = [
                CONFIG.FIELDS.STORAGE_KEY,         // 圃場データ
                CONFIG.DIRECTORIES.STORAGE_KEY,    // ディレクトリデータ
                'aiQuestionHistory',               // AIチャット履歴
                'directoryEditHintShown',          // UI表示設定フラグ
                'fields',                          // 旧形式の圃場データ（互換性のため）
                'savedFields'                      // 分析用保存フィールド
            ];
            
            return this.getSpecificStorageData(appKeys);
        },

        // データをJSONファイルとしてダウンロード
        downloadAsJson: function(data, filename) {
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || 'hatake-health-data.json';
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        },

        // 畑ヘルスチェックデータをエクスポート
        exportHatakeHealthData: function() {
            const data = this.getHatakeHealthData();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            this.downloadAsJson(data, `hatake-health-backup-${timestamp}.json`);
            return `データをエクスポートしました: ${Object.keys(data).length}つのデータセット`;
        },

        // データのインポート（将来の拡張用）
        importData: function(jsonData) {
            try {
                const data = JSON.parse(jsonData);
                
                // データをローカルストレージに保存
                Object.keys(data).forEach(key => {
                    const value = typeof data[key] === 'object' 
                        ? JSON.stringify(data[key]) 
                        : data[key];
                    
                    localStorage.setItem(key, value);
                });
                
                return `${Object.keys(data).length}つのデータセットをインポートしました`;
            } catch (e) {
                console.error('データのインポートに失敗しました:', e);
                return '無効なJSONデータです';
            }
        }
    };

    // グローバルに公開（UIで使用できるように）
    window.DATA_EXPORTER = DATA_EXPORTER;

    // エクスポートボタンは削除（UIの簡潔性のため）
    // 必要な場合は window.DATA_EXPORTER.exportHatakeHealthData() を直接呼び出してください

    console.log('データエクスポートツールを読み込みました。window.DATA_EXPORTER でアクセスできます。');
})();
