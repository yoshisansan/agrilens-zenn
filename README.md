# 畑の健康診断 - 複数植生指標分析機能

## 概要

Google Earth Engine (GEE) を使用して、以下の3つの植生指標を計算・分析する機能を実装しました：

1. **NDVI (Normalized Difference Vegetation Index)** - 植生の活力指標
   - 植物の光合成活性や植生の活力を示します
   - 計算式: (NIR - RED) / (NIR + RED)

2. **NDMI (Normalized Difference Moisture Index)** - 水分ストレス指標
   - 植物の水分含有量や水分ストレスを示します
   - 計算式: (NIR - SWIR1) / (NIR + SWIR1)

3. **NDRE (Red Edge Normalized Difference Vegetation Index)** - 栄養状態指標
   - 葉の窒素含有量や栄養状態を示します
   - 計算式: (NIR - RedEdge) / (NIR + RedEdge)

## 実装内容

### 1. 植生指標計算モジュール (vegetation-indices.js)

複数の植生指標を計算し、それぞれの健康状態を評価するための関数群を実装しています。作物タイプに応じた閾値設定も行い、総合的な健康診断と推奨アクションを生成します。

```javascript
// 主な機能
- calculateNDVI(image)     // NDVI計算
- calculateNDMI(image)     // NDMI計算
- calculateNDRE(image)     // NDRE計算
- calculateAllIndices(image) // 3つの指標を一度に計算
- evaluateIndicesHealth(stats, cropType) // 健康状態評価
- generateOverallDiagnosis(evaluation) // 総合評価と推奨アクション
```

### 2. マップ表示機能 (map.js)

各植生指標レイヤーの表示・切り替え機能を実装しています。

```javascript
// 主な機能
- addNdviLayer() // NDVI指標レイヤーの表示
- addNdmiLayer() // NDMI指標レイヤーの表示
- addNdreLayer() // NDRE指標レイヤーの表示
- toggleVegetationLayer() // 指標レイヤーの切り替え
```

### 3. 分析結果表示機能 (analysis.js)

各植生指標の分析結果をUIに表示する機能を実装しています。

```javascript
// 主な機能
- processIndicesStats() // 統計データの整形
- evaluateFieldHealth() // 健康状態の総合評価
- updateHealthSummary() // 健康サマリーの更新
- updateAiComment() // AI診断コメントの更新
- updateDetailedStats() // 詳細統計の更新
```

### 4. サーバーサイド処理 (server.js)

GEEからのデータ取得と植生指標計算を行うAPIエンドポイントを実装しています。

```javascript
// 主な機能
- /api/analyze: Sentinel-2画像からNDVI、NDMI、NDREを計算
- generateMockVegetationData(): GEE非接続時のモックデータ生成
```

### 5. 設定ファイル (config.js)

各植生指標の閾値設定を追加しました。

```javascript
// 設定内容
- NDVI閾値設定
- NDMI閾値設定
- NDRE閾値設定
- 各指標の表示パレット設定
```

## 使用方法

1. マップ上で圃場（ポリゴン）を描画または選択
2. 「分析開始」ボタンをクリック
3. 分析結果パネルに各植生指標の結果が表示される
4. 指標切り替えボタン（NDVI、NDMI、NDRE）で表示レイヤーを切り替え可能

## 技術詳細

- **データソース**: Sentinel-2衛星画像（Google Earth Engine経由）
- **空間解像度**: 10m（NDVI、NDRE）、20m（NDMI）
- **計算バンド**:
  - NDVI: B8（NIR）、B4（Red）
  - NDMI: B8（NIR）、B11（SWIR1）
  - NDRE: B8（NIR）、B5（Red Edge）

この機能の実装により、畑の健康状態をより多角的に分析できるようになりました。植生の活力だけでなく、水分ストレスや栄養状態も同時に評価することで、より詳細な診断と適切な対策を提案できます。
