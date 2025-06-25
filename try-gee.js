require('dotenv').config();
const ee = require('@google/earthengine');
const fs = require('fs');
const path = require('path');

// テスト用の簡単なEarth Engine処理
async function testEarthEngine() {
    try {
        console.log('Earth Engine初期化テストを開始します...');

        // サービスアカウントキーのJSONファイルを読み込む
        const keyPath = process.env.GOOGLE_PRIVATE_KEY_PATH;
        
        if (!keyPath) {
            throw new Error('GOOGLE_PRIVATE_KEY_PATH が設定されていません');
        }
        
        // JSONファイルから認証情報を読み込む
        const keyFile = path.resolve(__dirname, keyPath);
        
        if (!fs.existsSync(keyFile)) {
            throw new Error(`指定されたキーファイルが見つかりません: ${keyFile}`);
        }
        
        console.log(`キーファイルを読み込みます: ${keyFile}`);
        const privateKeyJson = JSON.parse(fs.readFileSync(keyFile, 'utf8'));
        
        // Earth Engineの初期化を行う
        await new Promise((resolve, reject) => {
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
        });

        // 簡単なテスト操作を実行
        console.log('テスト操作: 点の作成とgetInfo()...');
        const point = ee.Geometry.Point([138.898154, 35.089915]);
        const pointInfo = await point.getInfo();
        console.log('点の情報:', pointInfo);

        // 画像コレクションのテスト
        console.log('テスト操作: 画像コレクションの取得...');
        const collection = ee.ImageCollection('COPERNICUS/S2_SR')
            .filterDate('2023-01-01', '2023-12-31')
            .filterBounds(point)
            .limit(1);
            
        const count = await collection.size().getInfo();
        console.log(`利用可能な画像数: ${count}`);

        // 画像がある場合はNDVIを計算してタイルURLを生成
        if (count > 0) {
            console.log('NDVIの計算とタイルURL生成をテスト...');
            
            // 最初の画像を取得
            const image = collection.first();
            
            // NDVIの計算
            const ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
            
            // 可視化パラメータ
            const visParams = {
                min: -0.2,
                max: 0.8,
                palette: ['#d01c11', '#f1b543', '#4dac26']
            };
            
            // タイルURLの取得
            try {
                const mapId = await ndvi.getMapId(visParams);
                console.log('マップID情報:', JSON.stringify(mapId, null, 2));
                
                // 異なるAPIバージョンに対応
                let tileUrl;
                if (mapId && mapId.tile_fetcher && mapId.tile_fetcher.url_format_string) {
                    tileUrl = mapId.tile_fetcher.url_format_string;
                } else if (mapId && mapId.urlFormat) {
                    tileUrl = mapId.urlFormat;
                } else {
                    console.log('標準形式のタイルURLが見つかりません。代替形式を探します...');
                    // マップIDオブジェクトをダンプして構造を確認
                    for (const key in mapId) {
                        console.log(`キー: ${key}, 値: ${typeof mapId[key] === 'object' ? 'Object' : mapId[key]}`);
                    }
                    tileUrl = 'タイルURLが見つかりません';
                }
                
                console.log('生成されたタイルURL:', tileUrl);
            } catch (error) {
                console.error('タイルURL取得エラー:', error);
            }
            
            // 日付情報の取得
            const imageDate = ee.Date(image.get('system:time_start')).format('YYYY-MM-dd').getInfo();
            console.log('画像の日付:', imageDate);
        }

        // 処理が完了したら終了
        console.log('Earth Engineテスト完了');
    } catch (error) {
        console.error('テスト中にエラーが発生しました:', error);
    }
}

// テスト実行
testEarthEngine(); 