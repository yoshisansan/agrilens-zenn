// 圃場/区画管理のためのモジュール

// 区画データの構造
// {
//   id: 'uniqueId',
//   name: '圃場名',
//   memo: 'メモ',
//   crop: '作物名', // 栽培作物
//   createdAt: Date.now(),
//   updatedAt: Date.now(), 
//   center: [lat, lon],
//   geoJSON: {...}, // 区画のGeoJSONデータ
//   color: '#3b82f6', // 区画の表示色
//   lastAnalysis: null, // 最後の分析結果 (分析後に設定)
//   directoryId: 'directoryId' // 所属するディレクトリID
// }

// ディレクトリ(リスト)データの構造
// {
//   id: 'uniqueId',
//   name: 'ディレクトリ名',
//   crop: '作物名', // 栽培している作物
//   createdAt: Date.now(),
//   updatedAt: Date.now()
// }

// デフォルトディレクトリID（初期ディレクトリ）
const DEFAULT_DIRECTORY_ID = 'directory_default';

// 区画リストをストレージから取得
function getFieldsList() {
    const fieldsJSON = localStorage.getItem(CONFIG.FIELDS.STORAGE_KEY);
    let fields = fieldsJSON ? JSON.parse(fieldsJSON) : [];
    
    // 既存の区画に作物フィールドがなければ追加
    let needsUpdate = false;
    const directories = getDirectoriesList();
    
    fields.forEach(field => {
        if (!field.hasOwnProperty('crop')) {
            // 親リストの作物情報を取得
            const parentDir = directories.find(dir => dir.id === field.directoryId);
            field.crop = parentDir && parentDir.crop ? parentDir.crop : '';
            needsUpdate = true;
        }
    });
    
    // 更新があれば保存
    if (needsUpdate) {
        localStorage.setItem(CONFIG.FIELDS.STORAGE_KEY, JSON.stringify(fields));
    }
    
    return fields;
}

// 区画リストをストレージに保存
function saveFieldsList(fields) {
    localStorage.setItem(CONFIG.FIELDS.STORAGE_KEY, JSON.stringify(fields));
}

// ディレクトリリストをストレージから取得
function getDirectoriesList() {
    const directoriesJSON = localStorage.getItem(CONFIG.DIRECTORIES.STORAGE_KEY);
    let directories = directoriesJSON ? JSON.parse(directoriesJSON) : [];
    
    // デフォルトディレクトリがない場合は作成
    if (!directories.find(dir => dir.id === DEFAULT_DIRECTORY_ID)) {
        directories.push({
            id: DEFAULT_DIRECTORY_ID,
            name: CONFIG.DIRECTORIES.DEFAULT_NAME,
            crop: '稲', // デフォルトの作物
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
        
        // 保存
        localStorage.setItem(CONFIG.DIRECTORIES.STORAGE_KEY, JSON.stringify(directories));
    }
    
    // 既存のディレクトリに作物フィールドがなければ追加
    let needsUpdate = false;
    directories.forEach(dir => {
        if (!dir.hasOwnProperty('crop')) {
            dir.crop = '稲'; // 既存リストには「稲」を設定
            needsUpdate = true;
        }
    });
    
    // 更新があれば保存
    if (needsUpdate) {
        localStorage.setItem(CONFIG.DIRECTORIES.STORAGE_KEY, JSON.stringify(directories));
    }
    
    return directories;
}

// ディレクトリリストをストレージに保存
function saveDirectoriesList(directories) {
    localStorage.setItem(CONFIG.DIRECTORIES.STORAGE_KEY, JSON.stringify(directories));
}

// 新規区画の追加
function addField(fieldData) {
    const fields = getFieldsList();
    
    // 最大区画数のチェック
    if (fields.length >= CONFIG.FIELDS.MAX_FIELDS) {
        throw new Error(`区画数が上限（${CONFIG.FIELDS.MAX_FIELDS}個）に達しています。`);
    }
    
    // IDの生成
    const fieldId = 'field_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    // 新しい区画オブジェクトの作成
    const newField = {
        id: fieldId,
        name: fieldData.name || '名称未設定',
        memo: fieldData.memo || '',
        crop: fieldData.crop || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        center: fieldData.center || CONFIG.MAP.CENTER,
        geoJSON: fieldData.geoJSON,
        color: fieldData.color || CONFIG.FIELDS.DEFAULT_COLOR,
        lastAnalysis: null,
        directoryId: fieldData.directoryId || DEFAULT_DIRECTORY_ID
    };
    
    // 区画リストに追加して保存
    fields.push(newField);
    saveFieldsList(fields);
    
    return newField;
}

// 区画の更新
function updateField(fieldId, updateData) {
    const fields = getFieldsList();
    const fieldIndex = fields.findIndex(field => field.id === fieldId);
    
    if (fieldIndex === -1) {
        throw new Error('更新対象の区画が見つかりません。');
    }
    
    // 既存の区画に更新データをマージ
    const updatedField = {
        ...fields[fieldIndex],
        ...updateData,
        updatedAt: Date.now()
    };
    
    fields[fieldIndex] = updatedField;
    saveFieldsList(fields);
    
    return updatedField;
}

// 区画の削除
function deleteField(fieldId) {
    const fields = getFieldsList();
    const newFields = fields.filter(field => field.id !== fieldId);
    
    // 区画が見つからない場合
    if (fields.length === newFields.length) {
        throw new Error('削除対象の区画が見つかりません。');
    }
    
    saveFieldsList(newFields);
    return true;
}

// 特定の区画を取得
function getFieldById(fieldId) {
    const fields = getFieldsList();
    return fields.find(field => field.id === fieldId) || null;
}

// 区画の分析結果を保存
function saveFieldAnalysis(fieldId, analysisData) {
    return updateField(fieldId, {
        lastAnalysis: {
            ...analysisData,
            analyzedAt: Date.now()
        }
    });
}

// 複数の区画から選択された区画のみ取得
function getSelectedFields(fieldIds) {
    const fields = getFieldsList();
    return fields.filter(field => fieldIds.includes(field.id));
}

// 区画名でフィルタリング
function searchFieldsByName(searchTerm) {
    if (!searchTerm) return getFieldsList();
    
    const fields = getFieldsList();
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return fields.filter(field => 
        field.name.toLowerCase().includes(lowerSearchTerm) || 
        (field.memo && field.memo.toLowerCase().includes(lowerSearchTerm))
    );
}

// 区画データをソート (name, updatedAt, createdAt)
function sortFields(fields, sortBy = 'updatedAt', ascending = false) {
    return [...fields].sort((a, b) => {
        // orderプロパティが存在し、かつソートキーが'order'なら優先して使用
        if (sortBy === 'order' && a.order !== undefined && b.order !== undefined) {
            return ascending ? a.order - b.order : b.order - a.order;
        }
        
        // orderプロパティが両方にあれば、他のソートよりも優先して使用
        if (a.order !== undefined && b.order !== undefined) {
            // 両方に順序情報がある場合は、それを使う
            return ascending ? a.order - b.order : b.order - a.order;
        }
        
        let valueA, valueB;
        
        if (sortBy === 'name') {
            valueA = a.name.toLowerCase();
            valueB = b.name.toLowerCase();
            return ascending ? 
                valueA.localeCompare(valueB) : 
                valueB.localeCompare(valueA);
        } else {
            valueA = a[sortBy];
            valueB = b[sortBy];
            return ascending ? 
                valueA - valueB : 
                valueB - valueA;
        }
    });
}

// ディレクトリデータをソート (デフォルトディレクトリは常に先頭)
function sortDirectories(directories) {
    return [...directories].sort((a, b) => {
        // デフォルトディレクトリは常に先頭
        if (a.id === DEFAULT_DIRECTORY_ID) return -1;
        if (b.id === DEFAULT_DIRECTORY_ID) return 1;
        
        // それ以外は名前でソート
        return a.name.localeCompare(b.name);
    });
}

// 特定のディレクトリを取得
function getDirectoryById(directoryId) {
    const directories = getDirectoriesList();
    return directories.find(dir => dir.id === directoryId) || null;
}

// 新規ディレクトリの追加
function addDirectory(directoryData) {
    const directories = getDirectoriesList();
    
    // 最大ディレクトリ数のチェック
    if (directories.length >= CONFIG.DIRECTORIES.MAX_DIRECTORIES) {
        throw new Error(`リスト数が上限（${CONFIG.DIRECTORIES.MAX_DIRECTORIES}個）に達しています。`);
    }
    
    // IDの生成
    const directoryId = 'directory_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    // 新しいディレクトリオブジェクトの作成
    const newDirectory = {
        id: directoryId,
        name: directoryData.name || '新規リスト',
        crop: directoryData.crop || '', // 作物名
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    // ディレクトリリストに追加して保存
    directories.push(newDirectory);
    saveDirectoriesList(directories);
    
    return newDirectory;
}

// ディレクトリの更新
function updateDirectory(directoryId, updateData) {
    const directories = getDirectoriesList();
    const directoryIndex = directories.findIndex(dir => dir.id === directoryId);
    
    if (directoryIndex === -1) {
        throw new Error('更新対象のリストが見つかりません。');
    }
    
    // 既存のディレクトリに更新データをマージ
    const updatedDirectory = {
        ...directories[directoryIndex],
        ...updateData,
        updatedAt: Date.now()
    };
    
    directories[directoryIndex] = updatedDirectory;
    saveDirectoriesList(directories);
    
    return updatedDirectory;
}

// ディレクトリの削除
function deleteDirectory(directoryId) {
    const directories = getDirectoriesList();
    const newDirectories = directories.filter(dir => dir.id !== directoryId);
    
    // ディレクトリが見つからない場合
    if (directories.length === newDirectories.length) {
        throw new Error('削除対象のリストが見つかりません。');
    }
    
    // このディレクトリに所属する区画を新しいディレクトリに移動
    const fields = getFieldsList();
    
    // 移動先ディレクトリの決定
    let targetDirectoryId;
    if (newDirectories.length > 0) {
        // 残っているディレクトリの最初のものを使用
        targetDirectoryId = newDirectories[0].id;
    } else {
        // 残りがない場合は新しいデフォルトディレクトリを作成
        const newDefaultDir = {
            id: 'directory_' + Date.now() + '_default',
            name: CONFIG.DIRECTORIES.DEFAULT_NAME,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        newDirectories.push(newDefaultDir);
        targetDirectoryId = newDefaultDir.id;
    }
    
    // 区画の移動処理
    const updatedFields = fields.map(field => {
        if (field.directoryId === directoryId) {
            return {
                ...field,
                directoryId: targetDirectoryId,
                updatedAt: Date.now()
            };
        }
        return field;
    });
    
    saveDirectoriesList(newDirectories);
    saveFieldsList(updatedFields);
    
    return true;
}

// 特定ディレクトリ内の区画を取得
function getFieldsInDirectory(directoryId) {
    const fields = getFieldsList();
    
    // directoryIdが設定されていない場合は、デフォルトディレクトリとして扱う
    return fields.filter(field => 
        (field.directoryId || DEFAULT_DIRECTORY_ID) === directoryId
    );
}

// 区画を別ディレクトリに移動
function moveFieldToDirectory(fieldId, targetDirectoryId) {
    // ディレクトリの存在確認
    const directory = getDirectoryById(targetDirectoryId);
    if (!directory) {
        throw new Error('移動先のリストが見つかりません。');
    }
    
    // 区画の更新
    return updateField(fieldId, {
        directoryId: targetDirectoryId
    });
}

// 区画の中心座標をGeoJSONから計算
function calculateFieldCenter(geoJSON) {
    try {
        // GeoJSONからポリゴンの座標を取得
        let coordinates;
        
        if (geoJSON.type === 'Feature' && geoJSON.geometry) {
            coordinates = geoJSON.geometry.coordinates;
        } else if (geoJSON.coordinates) {
            coordinates = geoJSON.coordinates;
        } else {
            throw new Error('無効なGeoJSONデータ');
        }
        
        // ポリゴンまたは多角形の座標リストを取得
        let points;
        if (coordinates[0] && Array.isArray(coordinates[0]) && coordinates[0][0] && Array.isArray(coordinates[0][0])) {
            // ポリゴン（最初の輪郭を使用）
            points = coordinates[0];
        } else if (coordinates[0] && Array.isArray(coordinates[0]) && typeof coordinates[0][0] === 'number') {
            // 単純な座標リスト
            points = coordinates;
        } else {
            throw new Error('サポートされていないGeoJSON形式');
        }
        
        // 中心点の計算（単純な平均）
        let sumLat = 0;
        let sumLon = 0;
        
        for (const point of points) {
            sumLon += point[0];
            sumLat += point[1];
        }
        
        return [sumLat / points.length, sumLon / points.length];
    } catch (error) {
        console.error('中心点の計算に失敗しました:', error);
        return CONFIG.MAP.CENTER; // エラー時はデフォルト中心を返す
    }
}

// 区画情報のバックアップをJSONとしてエクスポート
function exportFields() {
    const fields = getFieldsList();
    const directories = getDirectoriesList();
    
    const exportData = {
        version: '1.1',
        exportDate: new Date().toISOString(),
        fields: fields,
        directories: directories
    };
    
    return JSON.stringify(exportData, null, 2);
}

// エクスポートされた区画情報のインポート
function importFields(jsonData) {
    try {
        const importData = JSON.parse(jsonData);
        
        if (!importData.fields || !Array.isArray(importData.fields)) {
            throw new Error('有効な区画データが含まれていません。');
        }
        
        // 既存のデータと統合（IDが同じ場合は上書き）
        const existingFields = getFieldsList();
        const existingIds = existingFields.map(field => field.id);
        
        const fieldsToAdd = importData.fields.filter(field => !existingIds.includes(field.id));
        const updatedFields = [
            ...existingFields,
            ...fieldsToAdd
        ];
        
        // 最大区画数のチェック
        if (updatedFields.length > CONFIG.FIELDS.MAX_FIELDS) {
            throw new Error(`インポート後の区画数が上限（${CONFIG.FIELDS.MAX_FIELDS}個）を超えます。`);
        }
        
        // ディレクトリのインポート（存在する場合）
        if (importData.directories && Array.isArray(importData.directories)) {
            const existingDirectories = getDirectoriesList();
            const existingDirIds = existingDirectories.map(dir => dir.id);
            
            const dirsToAdd = importData.directories.filter(dir => 
                !existingDirIds.includes(dir.id) && dir.id !== DEFAULT_DIRECTORY_ID
            );
            
            const updatedDirectories = [
                ...existingDirectories,
                ...dirsToAdd
            ];
            
            // 最大ディレクトリ数のチェック
            if (updatedDirectories.length > CONFIG.DIRECTORIES.MAX_DIRECTORIES) {
                throw new Error(`インポート後のリスト数が上限（${CONFIG.DIRECTORIES.MAX_DIRECTORIES}個）を超えます。`);
            }
            
            saveDirectoriesList(updatedDirectories);
        }
        
        saveFieldsList(updatedFields);
        return {
            success: true,
            added: fieldsToAdd.length,
            total: updatedFields.length
        };
    } catch (error) {
        console.error('区画データのインポートに失敗しました:', error);
        throw error;
    }
} 