# AgriLens - 衛星データとAIで実現する次世代農業支援システム

## はじめに

日本の農業は深刻な危機に直面しています。農業従事者数は2000年の240万人から現在では半減し、平均年齢は70歳を超えています。このままでは、私たちの食卓から国産食料が消える日も遠くないかもしれません。

しかし、テクノロジーには、この危機を機会に変える力があります。

**AgriLens**は、Google CloudのVertex AI技術とGoogle Earth Engineの衛星データ分析を組み合わせ、経験の浅い新規就農者でも、ベテラン農家に匹敵する精密な農業を実現できる次世代農業支援システムです。

## デモ動画

[YouTube動画埋め込み：3分以内のAgriLensデモ動画]

## 解決する課題

### 日本農業が直面する3つの危機

1. **人材の急速な減少**
   - 農業従事者の半減（2000年：240万人 → 現在：約120万人）
   - 平均年齢70歳超による大量リタイアの危機
   - 新規就農者の参入障壁の高さ

2. **技術継承の断絶**
   - ベテラン農家の経験知が失われる危機
   - 新規就農者が直面する「何をいつ、どれだけ」の判断の難しさ
   - 勘と経験に頼る農業からの脱却の必要性

3. **収益性の低さ**
   - 小規模農家にとって高額な精密農業システム
   - 適切な施肥・灌水管理の難しさによる収穫量の低下
   - 自然災害への対応の遅れ

### 衛星データ活用の実績

実は、衛星データを活用した農業支援には、すでに驚くべき成功事例があります：

- **収穫量2倍**：北海道十勝の玉ねぎ圃場で、衛星データに基づく水管理により実現
- **労働時間50%削減**：小麦の穂水分計測作業の効率化
- **品質向上率2倍以上**：山口県の小麦農家で品質基準達成率が25%→56%に向上

これらの成果は、衛星データの有効性を証明していますが、問題は**専門知識なしには活用できない**ことでした。

## ターゲットユーザー

AgriLensは、以下のユーザーを主なターゲットとしています：

### 1. 新規就農者
- 農業経験が浅く、作物の状態判断に不安を抱える方
- データに基づく客観的な判断を求める方
- ITリテラシーがあり、テクノロジーを活用したい方

### 2. 兼業農家
- 限られた時間で効率的に農地管理をしたい方
- 週末だけの農作業でも高品質な作物を育てたい方
- 遠隔での農地モニタリングを必要とする方

### 3. 小規模農家
- 高額な精密農業システムを導入できない方
- シンプルで使いやすいツールを求める方
- 収穫量と品質の向上を目指す方

## ソリューション：AgriLensの特徴

### 1. RAG的アプローチによるAI農業アドバイス

AgriLensの最大の特徴は、**リアルタイムの衛星データをコンテキストとしてAIに提供する**RAG（Retrieval-Augmented Generation）的なアプローチです。

```
[ユーザーの質問] + [現在の圃場データ] → [専門的なAIアドバイス]
```

例えば、「今、施肥すべきですか？」という質問に対して、AIは：
- 現在のNDVI（植生活力度）
- NDMI（水分ストレス）
- NDRE（葉緑素量）
- 過去の推移データ

これらを総合的に判断し、「現在のNDVI値0.65は健全ですが、NDMI値が0.3と低く、水分ストレスが見られます。施肥より先に灌水を優先することをお勧めします」といった具体的なアドバイスを提供します。

### 2. 複数AIモデルの戦略的活用

AgriLensは、用途に応じて最適なAIモデルを使い分けています：

**メイン分析：Geminiシリーズ**
- `gemini-1.5-flash`：高速応答、コスト効率重視
- `gemini-1.5-pro`：高精度な圃場分析と複雑な農業相談
- `gemini-2.0-flash-thinking-exp-01-21`：最新の思考型モデルによる高度な推論（デフォルト）

**おすすめ質問生成：Gemmaシリーズ**
- `gemma-2-9b-it`：軽量で高速な質問生成
- `gemma-2-27b-it`：より洗練された質問提案

特にGemmaを「おすすめ質問」機能に採用したのは、分析結果のコンテキストを保持しながら、軽量モデルで素早く次の質問を提案できるためです。これにより、ユーザーは専門知識がなくても、適切な質問を続けることができます。

### 3. 直感的な操作性

1. **地図で選ぶだけ**：Leaflet.jsによる直感的な圃場選択
2. **即座に分析**：Google Earth Engineが最新の衛星画像を処理
3. **視覚的に理解**：植生指標を色分けマップで表示
4. **会話で深掘り**：AIチャットで疑問を解決

## システムアーキテクチャ

### 技術スタック詳細

#### フロントエンド
- **Pure JavaScript/HTML5/CSS3**：フレームワークレスで軽量なWebアプリケーション
- **Leaflet.js**：オープンソースの地図ライブラリ
- **LocalStorage**：クライアントサイドデータ永続化
- **レスポンシブデザイン**：モバイル対応UI

#### バックエンド（Node.js + Express.js）
- **Express.js**：軽量なWebアプリケーションフレームワーク
- **express-session**：セッション管理
- **cors**：クロスオリジンリソース共有対応
- **dotenv**：環境変数管理

#### Google Cloud連携
- **Vertex AI SDK**：`@google-cloud/vertexai` v1.0.0
- **Google Earth Engine**：`@google/earthengine` v0.1.419
- **Google Auth Library**：`google-auth-library` v9.15.1
- **サービスアカウント認証**：セキュアなAPI連携

### データ処理フロー

1. **衛星データ取得（実際の実装）**
   ```javascript
   // Google Earth Engineサーバーサイド処理
   async function fetchGEEAnalysis(aoiGeoJSON) {
       const response = await fetch('/api/analyze', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ aoiGeoJSON: geometryData })
       });
       return await response.json();
   }
   ```

2. **植生指標計算（vegetation-indices.js）**
   ```javascript
   // NDVI（植生活力度）の計算
   function calculateNDVI(image) {
       return image.normalizedDifference(['B8', 'B4']).rename('NDVI');
   }
   
   // NDMI（水分ストレス）の計算
   function calculateNDMI(image) {
       return image.normalizedDifference(['B8', 'B11']).rename('NDMI');
   }
   
   // NDRE（葉緑素量）の計算
   function calculateNDRE(image) {
       return image.normalizedDifference(['B8', 'B5']).rename('NDRE');
   }
   ```

3. **AI分析プロンプト生成（実際の実装）**
   ```javascript
   // gemini-api.jsからの実際のプロンプト
   const templateString = `あなたは専門の農業アドバイザーです。以下の圃場の衛星画像分析データに基づいて、農家向けの包括的なアドバイスを日本語で、必ず下記のJSON形式で提供してください。

   JSONスキーマ:
   {
     "重要な知見のまとめ": "分析結果の最も重要なポイント",
     "詳細な評価": {
       "NDVI": {"value": 0.61, "text": "植生活力の評価..."},
       "NDMI": {"value": 0.27, "text": "水分ストレスの評価..."},
       "NDRE": {"value": 0.41, "text": "栄養状態の評価..."}
     },
     "具体的な対策": ["推奨される具体的な行動ステップ"],
     "今後の管理ポイント": ["長期的な管理や注意点"]
   }
   
   分析データ:
   圃場名: ${fieldData.name}
   NDVI (植生活力指数): ${analysisData.ndvi}
   NDMI (水分ストレス指数): ${analysisData.ndmi}
   NDRE (葉緑素量指数): ${analysisData.ndre}`;
   ```

## 主要機能の実装

### 1. リアルタイム圃場分析

サーバーサイドでGoogle Earth Engineを使用し、Sentinel-2衛星データから植生指標を計算します。

```javascript
// server.jsでのEarth Engine初期化
function initializeEarthEngine() {
    return new Promise((resolve, reject) => {
        // 環境変数からサービスアカウント認証情報を構築
        const privateKeyJson = {
            type: "service_account",
            project_id: process.env.GOOGLE_PROJECT_ID,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            // ... その他の認証情報
        };
        
        ee.data.authenticateViaPrivateKey(privateKeyJson, resolve, reject);
    });
}
```

### 2. Vertex AI統合（実際の実装）

複数のAIモデルを戦略的に使い分けるシステム：

```javascript
// server.jsでのVertex AI設定
async function handleVertexAIRequest(prompt, modelName) {
    const vertexAI = new VertexAI.VertexAI({
        project: GOOGLE_PROJECT_ID,
        location: GOOGLE_CLOUD_REGION,
        googleAuthOptions: { credentials: serviceAccountKey }
    });

    // モデルタイプによる分岐
    if (modelName.startsWith('gemma')) {
        return handleGemmaRequest(vertexAI, prompt, modelName);
    } else {
        return handleGeminiVertexRequest(vertexAI, prompt, modelName);
    }
}
```

### 3. AIチャット機能（実際の実装）

```javascript
// ai-chat.jsでのチャット処理
async function generateAiResponse(userMessage) {
    const fieldData = getCurrentFieldData();
    const analysisData = getLatestAnalysisData();
    
    // プロンプトの準備（圃場データ含む）
    const prompt = prepareAiPrompt(userMessage, fieldData, analysisData);
    
    // サーバーサイドAPI経由でVertex AIを使用
    const response = await fetch('/api/ai-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, model: getSelectedModel() })
    });
    
    return await response.json();
}
```

### 4. AIモデル選択機能

```javascript
// ai-model-selector.jsでの実装
class AiModelSelector {
    constructor() {
        this.availableModels = {
            gemini: [
                { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: '高速な応答、コスト効率重視' },
                { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '高精度、複雑なタスク向け' },
                { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking (Experimental)', description: '最新の思考型モデル、実験的機能' }
            ],
            gemma: [
                { id: 'gemma-2-9b-it', name: 'Gemma 2 9B IT', description: 'オープンソース、中規模モデル' },
                { id: 'gemma-2-27b-it', name: 'Gemma 2 27B IT', description: 'オープンソース、大規模モデル' }
            ]
        };
        this.defaultModel = 'gemini-2.0-flash-thinking-exp-01-21';
    }
}
```

## 実装の工夫点

### 1. エラーハンドリングとフォールバック（実際の実装）

```javascript
// analysis.jsでのグレースフルデグレーション
async function fetchGEEAnalysis(aoiGeoJSON) {
    try {
        const response = await fetch('/api/analyze', { /* ... */ });
        return await response.json();
    } catch (error) {
        // 認証エラーの場合はモックデータにフォールバック
        if (error.message && (
            error.message.includes('authentication credential') || 
            error.message.includes('OAuth') ||
            error.message.includes('Earth Engine')
        )) {
            showToast("認証エラー", "Google Earth Engineへの認証に失敗しました。モックデータを使用します。");
            return createLocalMockData(aoiGeoJSON);
        }
        throw error;
    }
}
```

### 2. 複数APIプロバイダー対応

```javascript
// server.jsでのフレキシブルなAI設定
const API_PROVIDER = process.env.AI_API_PROVIDER || 'vertex'; // 'vertex' | 'gemini-direct'

app.post('/api/ai-advice', async (req, res) => {
    let result;
    if (API_PROVIDER === 'vertex' && VertexAI) {
        result = await handleVertexAIRequest(prompt, selectedModel);
    } else {
        // フォールバック: 従来のGemini APIを使用
        result = await handleDirectGeminiRequest(prompt, selectedModel, fetch);
    }
    res.json({ success: true, result });
});
```

### 3. モジュラー設計

実際のファイル構造：
```
js/
├── modules/
│   ├── ai-model-selector.js    # AIモデル選択機能
│   ├── error-handler.js        # エラーハンドリング
│   └── module-manager.js       # モジュール管理
├── analysis.js                 # 分析処理
├── gemini-api.js              # AI API連携
├── ai-chat.js                 # チャット機能
├── vegetation-indices.js      # 植生指標計算
├── map.js                     # 地図UI
└── config.js                  # 設定管理
```

### 4. テスト駆動開発

```javascript
// package.jsonのテスト設定
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "jest": "^30.0.3",
    "babel-jest": "^30.0.2",
    "@jest/globals": "^30.0.3"
  }
}
```

## パッケージ依存関係（実際の構成）

```json
{
  "dependencies": {
    "@google/earthengine": "^0.1.419",
    "@google-cloud/vertexai": "^1.0.0",
    "express": "^4.18.2",
    "express-session": "^1.18.1",
    "google-auth-library": "^9.15.1",
    "googleapis": "^148.0.0",
    "node-fetch": "^3.3.2",
    "cors": "^2.8.5",
    "dotenv": "^16.5.0"
  }
}
```

## 今後の展望

### 短期的な改善（3ヶ月以内）
1. **プロンプトの最適化**：作物別・地域別の専門的なプロンプト開発
2. **簡易RAG実装**：農業専門知識のベクトルデータベース構築
3. **UI/UX改善**：ユーザーフィードバックに基づく操作性向上

### 中期的な拡張（6ヶ月〜1年）
1. **施肥ムラマップ機能**：圃場内の詳細な施肥量最適化
2. **年間比較機能**：過去データとの比較による改善提案
3. **クラウドDB移行**：データ共有と大規模化対応

### 長期的なビジョン（1年以上）
1. **技術継承プラットフォーム**：ベテラン農家のノウハウをAIが学習
2. **地域連携機能**：近隣農家との情報共有
3. **自動化連携**：IoTデバイスとの連携による自動制御

## 技術的な挑戦と解決

### 1. 衛星データの精度問題

**課題**：雲や大気の影響による画像品質の低下

**解決策**：
- 複数日のデータから最良の画像を自動選択
- Google Earth Engineの前処理機能を活用

### 2. リアルタイム性の確保

**課題**：大容量の衛星データ処理による遅延

**解決策**：
- Google Earth Engineのサーバーサイド処理
- 必要最小限のデータのみクライアントに転送
- プログレッシブレンダリングによる段階的表示

### 3. AIの農業知識の深化

**課題**：一般的なLLMの農業専門知識の限界

**解決策**：
- 詳細なJSONスキーマによる構造化出力
- 圃場データをコンテキストとしてリアルタイム提供
- 複数モデルの特性を活かした使い分け

## 社会的インパクト

AgriLensは、単なる技術デモではありません。日本の農業が直面する危機に対して、実用的な解決策を提供します。

### 1. 新規就農者の参入障壁を下げる

経験不足を技術で補い、誰もが農業に挑戦できる環境を作ります。ベテラン農家の「勘」をデータとAIで再現し、失敗のリスクを最小化します。

### 2. 農業の収益性向上

実績ある衛星データ活用により：
- 収穫量の向上（最大2倍の実績）
- 品質の安定化
- 労働時間の削減（最大50%）

### 3. 持続可能な農業の実現

- 適切な施肥による環境負荷の軽減
- 水資源の効率的利用
- データに基づく長期的な土壌管理

## まとめ

AgriLensは、Google CloudのVertex AI技術（Gemini/Gemma）とGoogle Earth Engineの衛星データ分析を融合させ、誰もが使える実用的な農業支援システムとして開発しました。

**技術的な革新性**：
- RAG的アプローチによる文脈を考慮したAIアドバイス
- 複数AIモデルの戦略的な使い分け
- リアルタイム衛星データ処理とWeb技術の融合

**社会的な価値**：
- 新規就農者の技術的サポート
- 小規模農家でも導入可能な設計
- 実証された効果（収穫量向上、労働時間削減）

**将来性**：
- 拡張可能なアーキテクチャ
- 継続的な機能追加計画
- 農業DXのプラットフォームとしての発展

私たちは、テクノロジーの力で日本の農業を守り、発展させることができると信じています。AgriLensは、その第一歩です。

---

**プロジェクトリポジトリ**: [GitHub URL]

**デプロイURL**: [AgriLens URL]

**お問い合わせ**: [連絡先]

#aiagentzenn #googlecloud #vertexai #earthengine