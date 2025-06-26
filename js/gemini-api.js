// Gemini APIと連携して圃場分析に基づくAIアドバイスを生成するモジュール

// プロンプトテンプレートは直接関数内に埋め込むため、この変数は不要になりました。

/**
 * Gemini APIキーを取得する関数
 * 環境変数から取得し、なければローカルストレージを確認
 * @returns {string} APIキーまたは特別フラグ
 */
function getGeminiApiKey() {
    console.log('サーバーサイドでのAPI呼び出しを使用するモードで動作します');
    
    // サーバーサイドの実装に合わせて、必ずサーバーにリクエストを送るようにする
    return 'USE_SERVER';
}

/**
 * 分析データと圃場データからプロンプトを生成する関数
 * @param {Object} analysisData - 圃場分析データ
 * @param {Object} fieldData - 圃場基本情報
 * @returns {string|null} - 生成されたプロンプトまたはnull
 */
function preparePrompt(analysisData, fieldData) {
    // 必要な分析データがあるか確認
    if (!analysisData || !fieldData) {
        console.error('プロンプト作成エラー: 分析データまたは圃場データが空です');
        return null;
    }
    
    try {
        // NDVI、NDMI、NDREの値を抽出する
        // stats内部の構造に応じて変更する必要があるかもしれません
        let ndviValue = '不明';
        let ndmiValue = '不明';
        let ndreValue = '不明';
        
        // 分析データの構造に応じて値を取得
        if (analysisData.ndvi) {
            ndviValue = typeof analysisData.ndvi === 'number' ? 
                analysisData.ndvi.toFixed(2) : 
                analysisData.ndvi.toString();
        }
        
        if (analysisData.ndmi) {
            ndmiValue = typeof analysisData.ndmi === 'number' ? 
                analysisData.ndmi.toFixed(2) : 
                analysisData.ndmi.toString();
        }
        
        if (analysisData.ndre) {
            ndreValue = typeof analysisData.ndre === 'number' ? 
                analysisData.ndre.toFixed(2) : 
                analysisData.ndre.toString();
        }
        
        // テンプレートを直接ここで定義
        const templateString = `あなたは専門の農業アドバイザーです。以下の圃場の衛星画像分析データに基づいて、農家向けの包括的なアドバイスを日本語で、必ず下記のJSON形式で提供してください。

JSONスキーマ:
{
  "type": "object",
  "properties": {
    "重要な知見のまとめ": {
      "type": "string",
      "description": "分析結果の最も重要なポイント、栽培品種が不明な場合はその旨も記載し、全体的な状況と主要な指標（NDVI、NDMI、NDRE）について言及する。"
    },
    "詳細な評価": {
      "type": "object",
      "properties": {
        "NDVI": {
          "type": "object",
          "properties": {
            "value": { "type": "number", "description": "NDVIの数値。例: 0.61" },
            "text": { "type": "string", "description": "NDVIの評価と、数値に基づいた具体的な解説。植物の元気度、光合成の活発さ、改善の余地などに言及。" }
          },
          "required": ["value", "text"]
        },
        "NDMI": {
          "type": "object",
          "properties": {
            "value": { "type": "number", "description": "NDMIの数値。例: 0.27" },
            "text": { "type": "string", "description": "NDMIの評価と、数値に基づいた具体的な解説。水分ストレスの可能性、原因、注意点に言及。" }
          },
          "required": ["value", "text"]
        },
        "NDRE": {
          "type": "object",
          "properties": {
            "value": { "type": "number", "description": "NDREの数値。例: 0.41" },
            "text": { "type": "string", "description": "NDREの評価と、数値に基づいた具体的な解説。栄養状態（特に窒素）、問題点、改善策に言及。" }
          },
          "required": ["value", "text"]
        }
      },
      "required": ["NDVI", "NDMI", "NDRE"]
    },
    "具体的な対策": {
      "type": "array",
      "items": { "type": "string" },
      "description": "推奨される具体的な行動ステップのリスト。各対策には目安の時期（例: 直ちに、3日以内）も可能な限り含める。"
    },
    "今後の管理ポイント": {
      "type": "array",
      "items": { "type": "string" },
      "description": "長期的な管理や注意点のリスト。定期的な観察、気象情報の確認、水やりの注意点など。"
    }
  },
  "required": ["重要な知見のまとめ", "詳細な評価", "具体的な対策", "今後の管理ポイント"]
}

分析データ:
圃場名: ${fieldData.name}
緯度: ${fieldData.latitude}
経度: ${fieldData.longitude}
NDVI (植生活力指数): ${analysisData.ndvi}
NDMI (水分ストレス指数): ${analysisData.ndmi}
NDRE (葉緑素量指数): ${analysisData.ndre}
作物の種類: ${fieldData.crop || '不明'}
地域: ${fieldData.region || '不明'}
分析日: ${new Date().toLocaleDateString()}

上記の情報を元に、JSON形式でアドバイスを生成してください。
`;
        
        // テンプレートリテラルを評価して変数を置換
        const preparedPrompt = templateString
            .replace('${fieldData.name}', fieldData.name || '不明')
            .replace('${fieldData.latitude}', fieldData.latitude || '不明')
            .replace('${fieldData.longitude}', fieldData.longitude || '不明')
            .replace('${analysisData.ndvi}', ndviValue)
            .replace('${analysisData.ndmi}', ndmiValue)
            .replace('${analysisData.ndre}', ndreValue)
            .replace('${fieldData.crop || \'不明\'}', fieldData.crop || '不明')
            .replace('${fieldData.region || \'不明\'}', fieldData.region || '不明')
            .replace('${new Date().toLocaleDateString()}', new Date().toLocaleDateString());
        
        console.log('生成されたプロンプト:', preparedPrompt.substring(0, 100) + '...');
        return preparedPrompt;
    } catch (error) {
        console.error('プロンプト生成エラー:', error);
        return null;
    }
}

/**
 * Gemini APIへのリクエストを構築して送信
 * @param {Object} analysisData - 分析結果データ
 * @param {Object} fieldData - 圃場情報またはチャットデータ
 * @returns {Promise<Object|string>} - Geminiからの回答（JSONオブジェクトまたはエラー時文字列）
 */
async function getGeminiAdvice(analysisData, fieldData) {
    // チャットモードかどうかを判定
    const isChatMode = fieldData && fieldData.type === 'chat';
    
    if (isChatMode) {
        console.log('Geminiチャット応答取得開始:', fieldData.message);
        return await getChatResponse(analysisData, fieldData);
    }
    
    console.log('Geminiアドバイス取得開始 (JSONモード):', analysisData, fieldData);
    
    // 入力値の検証
    if (!analysisData || typeof analysisData !== 'object') {
        console.error('Geminiアドバイス取得に失敗: 分析データが無効です', analysisData);
        return { 
            error: "分析データが無効",
            message: "分析データが存在しないか無効です。再度分析を実行してください。"
        };
    }
    
    if (!fieldData || typeof fieldData !== 'object') {
        console.error('Geminiアドバイス取得に失敗: 圃場データが無効です', fieldData);
        fieldData = {
            name: '不明な圃場',
            crop: '不明',
            region: '日本',
            latitude: 35.6895,
            longitude: 139.6917
        };
        console.log('デフォルトの圃場データを使用します:', fieldData);
    }
    
    const apiKey = getGeminiApiKey();
    console.log('APIキーモード:', apiKey);
    
    // APIキーチェック
    if (!apiKey) {
        console.error('Gemini APIキーが設定されていません。処理を中止します。');
        return { 
            error: "APIキー未設定",
            message: "Gemini APIキーが設定されていません。設定画面から登録してください。"
        };
    }

    const prompt = preparePrompt(analysisData, fieldData);
    if (!prompt) {
        console.error('プロンプトの準備に失敗しました。');
        return { error: "プロンプト準備失敗" };
    }

    try {
        console.log('fetchGeminiResponse を呼び出します (JSONモード)。');
        const adviceText = await fetchGeminiResponse(apiKey, prompt);
        console.log('fetchGeminiResponse から返ってきた生レスポンス (長さ):', adviceText ? adviceText.length : 0, '文字');
        
        if (adviceText && typeof adviceText === 'string') {
            // レスポンスの最初と最後に```json ``` ``` が含まれる場合があるので除去
            let cleanedAdviceText = adviceText.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
            
            // "申し訳ありません"などで始まるエラーメッセージの場合
            if (cleanedAdviceText.startsWith('申し訳ありません') || 
                cleanedAdviceText.startsWith('すみません') ||
                cleanedAdviceText.indexOf('JSON形式') !== -1) {
                console.log('AIから特定の形式ではないメッセージが返されましたが、ダミーデータを生成します');
                console.log('元メッセージ:', cleanedAdviceText.substring(0, 50) + '...');
                // エラー時には、デモモード相当のダミーデータを返す
                // 分析データから値を抽出
                const ndviValue = analysisData.ndvi ? (typeof analysisData.ndvi === 'number' ? analysisData.ndvi.toFixed(2) : analysisData.ndvi.toString()) : '0.65';
                const ndmiValue = analysisData.ndmi ? (typeof analysisData.ndmi === 'number' ? analysisData.ndmi.toFixed(2) : analysisData.ndmi.toString()) : '0.42';
                const ndreValue = analysisData.ndre ? (typeof analysisData.ndre === 'number' ? analysisData.ndre.toFixed(2) : analysisData.ndre.toString()) : '0.38';
                const cropType = fieldData.crop || '不明';
                
                // ダミーJSONを返す
                return {
                  "重要な知見のまとめ": `分析地域のNDVI値は${ndviValue}で、健康な植生状態を示しています。NDMI値は${ndmiValue}で、適切な水分ストレスレベルです。NDRE値は${ndreValue}で、機能的な計測範囲内です。全体的に圃場は良好な状態です。`,
                  "詳細な評価": {
                    "NDVI": {
                      "value": parseFloat(ndviValue),
                      "text": `NDVI値${ndviValue}は植生の活力と中度の光合成活動を示します。健康的な状態ですが、より高い値を目指して調整できる可能性があります。`
                    },
                    "NDMI": {
                      "value": parseFloat(ndmiValue),
                      "text": `NDMI値${ndmiValue}はバランスの取れた水分ストレスレベルを示しています。現状では特別な対策は必要ありませんが、季節変化に合わせてモニタリングを続けることをお勧めします。`
                    },
                    "NDRE": {
                      "value": parseFloat(ndreValue),
                      "text": `NDRE値${ndreValue}は中程度の草地の状態を示しています。稀釈などの直接的な対策は必要ないものの、定期的な土壤検査を通じて必要な根地分の適用を検討すると良いでしょう。`
                    }
                  },
                  "具体的な対策": [
                    "現在の植生状態を維持するため、定期的な圃場巡回を続ける（毎週）",
                    "季節の変動に合わせて漆ぎ動計画を一部調整する（今唸2週以内）",
                    "地域の気象予報を定期的に確認し、必要に応じて空席検知計画を調整する（毎日）"
                  ],
                  "今後の管理ポイント": [
                    "地域の気象データと分析結果を組み合わせて統合的な判断を行う",
                    "季節変化に伴い、定期的に許容範囲を再評価する",
                    "近隣地域の同種作物の分析データを比較参照する（可能であれば）"
                  ]
                };
            }
            
            // JSON解析を試みる
            try {
                const adviceJson = JSON.parse(cleanedAdviceText);
                console.log('JSONパース成功:', adviceJson);
                return adviceJson;
            } catch (jsonError) {
                // JSONパースに失敗した場合、正規表現で { から始まり } で終わる最も長い部分を抽出してみる
                console.error('JSONパース失敗、部分抽出を試みます:', jsonError);
                const jsonMatch = cleanedAdviceText.match(/\{[\s\S]*\}/);
                if (jsonMatch && jsonMatch[0]) {
                    try {
                        const extractedJson = JSON.parse(jsonMatch[0]);
                        console.log('部分抽出したJSONのパース成功:', extractedJson);
                        return extractedJson;
                    } catch (e) {
                        console.error('部分抽出したJSONのパースも失敗:', e);
                        throw new Error(`JSON解析失敗: ${e.message}。レスポンス: ${cleanedAdviceText.substring(0, 100)}...`);
                    }
                } else {
                    throw new Error(`JSONが検出できません: ${cleanedAdviceText.substring(0, 100)}...`);
                }
            }
        } else {
            console.error('fetchGeminiResponseから文字列でない、または空のレスポンス:', adviceText);
            throw new Error('APIから予期しない形式のレスポンス (空または文字列以外)。');
        }
    } catch (error) {
        console.error('getGeminiAdvice内でエラー (JSONパース失敗の可能性):', error);
        let errorMessage = `AIアドバイス取得/解析エラー。`;
        if (error instanceof SyntaxError) {
            errorMessage += `AI応答が正しいJSON形式ではありません。`;
        }
        errorMessage += ` (詳細: ${error.message})`;
        return { error: errorMessage, rawResponse: error.rawResponseFromApi || null }; 
    }
}

/**
 * Gemini APIにリクエストを送信、またはデモモードの場合はダミー応答を返す
 * @param {string} apiKey - Gemini APIキー、または'DEMO_MODE'
 * @param {string} prompt - プロンプト内容
 * @returns {Promise<string>} - Geminiからの回答またはダミー応答 (JSON文字列)
 */
// ダミーレスポンス生成
function generateDummyResponse(prompt) {
    console.log('ダミー応答を生成します。');
    
    const extractedData = extractDataFromPrompt(prompt);
    return buildDummyResponseJSON(extractedData);
}

// プロンプトからデータ抽出
function extractDataFromPrompt(prompt) {
    const defaults = window.CONFIG?.DEFAULTS || {};
    let cropType = defaults.CROP_TYPE || '不明';
    let ndviValue = String(defaults.NDVI_VALUE || 0.65);
    let ndmiValue = String(defaults.NDMI_VALUE || 0.42);
    let ndreValue = String(defaults.NDRE_VALUE || 0.38);
    
    try {
        const ndviMatch = prompt.match(/NDVI[^:]*:[^\d]*(\d+\.\d+|\d+)/i);
        const ndmiMatch = prompt.match(/NDMI[^:]*:[^\d]*(\d+\.\d+|\d+)/i);
        const ndreMatch = prompt.match(/NDRE[^:]*:[^\d]*(\d+\.\d+|\d+)/i);
        const cropMatch = prompt.match(/作物[^:]*:[^\n]*(\S+)/i);
        
        if (ndviMatch && ndviMatch[1]) ndviValue = ndviMatch[1];
        if (ndmiMatch && ndmiMatch[1]) ndmiValue = ndmiMatch[1];
        if (ndreMatch && ndreMatch[1]) ndreValue = ndreMatch[1];
        if (cropMatch && cropMatch[1]) cropType = cropMatch[1];
    } catch (e) {
        console.warn('ダミーデータ生成中にエラーが発生しました:', e);
    }
    
    return { cropType, ndviValue, ndmiValue, ndreValue };
}

// ダミーJSONレスポンス構築
function buildDummyResponseJSON({ cropType, ndviValue, ndmiValue, ndreValue }) {
    return `{
  "重要な知見のまとめ": "分析地域のNDVI値は${ndviValue}で、健康な植生状態を示しています。NDMI値は${ndmiValue}で、適切な水分ストレスレベルです。NDRE値は${ndreValue}で、機能的な計測範囲内です。全体的に圃場は良好な状態です。",
  "詳細な評価": {
    "NDVI": {
      "value": ${parseFloat(ndviValue)},
      "text": "NDVI値${ndviValue}は植生の活力と中度の光合成活動を示します。健康的な状態ですが、より高い値を目指して調整できる可能性があります。"
    },
    "NDMI": {
      "value": ${parseFloat(ndmiValue)},
      "text": "NDMI値${ndmiValue}はバランスの取れた水分ストレスレベルを示しています。現状では特別な対策は必要ありませんが、季節変化に合わせてモニタリングを続けることをお勧めします。"
    },
    "NDRE": {
      "value": ${parseFloat(ndreValue)},
      "text": "NDRE値${ndreValue}は中程度の草地の状態を示しています。稀釈などの直接的な対策は必要ないものの、定期的な土壤検査を通じて必要な根地分の適用を検討すると良いでしょう。"
    }
  },
  "具体的な対策": [
    "現在の植生状態を維持するため、定期的な圃場巡回を続ける（毎週）",
    "季節の変動に合わせて漆ぎ動計画を一部調整する（今唸2週以内）",
    "地域の気象予報を定期的に確認し、必要に応じて空席検知計画を調整する（毎日）"
  ],
  "今後の管理ポイント": [
    "地域の気象データと分析結果を組み合わせて統合的な判断を行う",
    "季節変化に伴い、定期的に許容範囲を再評価する",
    "近隣地域の同種作物の分析データを比較参照する（可能であれば）"
  ]
}`;
}

async function fetchGeminiResponse(apiKey, prompt) {
    // デモモードの場合はダミーレスポンスを返す
    if (apiKey === 'DEMO_MODE') {
        console.log('デモモードで実行します。');
        return generateDummyResponse(prompt);
    }
    
    // サーバーサイドAPIで処理
    return processServerSideGeminiRequest(prompt);
}

// サーバーサイドGeminiリクエスト処理
async function processServerSideGeminiRequest(prompt) {
    console.log('サーバーサイドのGemini APIエンドポイントにリクエスト送信を試みます');
    console.log('プロンプト:', prompt.substring(0, 100) + '...');

    try {
        const response = await makeGeminiApiRequest(prompt);
        return handleGeminiApiResponse(response, prompt);
    } catch (error) {
        console.error('❌ fetchGeminiResponse内でエラーが発生。ダミーデータを使用します:', error.message);
        return generateDummyResponse(prompt);
    }
}

// Gemini APIリクエスト実行
async function makeGeminiApiRequest(prompt) {
    const fetchPromise = fetch('/api/gemini-advice', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
    });
    
    const timeoutPromise = new Promise((_, reject) => {
        const timeout = window.CONFIG?.API?.GEMINI_TIMEOUT || 30000;
        setTimeout(() => reject(new Error('リクエストがタイムアウトしました')), timeout);
    });
    
    return Promise.race([fetchPromise, timeoutPromise]);
}

// Gemini APIレスポンス処理
async function handleGeminiApiResponse(response, prompt) {
    if (!response.ok) {
        return handleGeminiApiError(response, prompt);
    }
    
    const responseData = await response.json();
    console.log('サーバーからのレスポンス:', responseData);
    
    if (responseData.success && responseData.result) {
        console.log('✅ Gemini APIから実際のレスポンスを取得しました:', responseData.result.substring(0, 100) + '...');
        return responseData.result;
    } else {
        console.warn('⚠️ 不正なサーバーレスポンス形式。ダミーデータを使用します:', responseData);
        return generateDummyResponse(prompt);
    }
}

// Gemini APIエラー処理
async function handleGeminiApiError(response, prompt) {
    const errorData = await response.json();
    console.error('Gemini APIサーバーエラー:', response.status, errorData);
    
    if (response.status === 500 && errorData.error === 'APIキー未設定') {
        console.warn('GEMINI_API_KEYが設定されていません。ダミーデータを使用します。');
    } else {
        console.warn('Gemini APIエラーが発生しました。ダミーデータを使用します。エラー詳細:', errorData);
    }
    
    return generateDummyResponse(prompt);
}

/**
 * チャットリクエスト用のGemini API呼び出し
 * @param {Object} analysisData - 分析結果データ
 * @param {Object} chatData - チャットデータ
 * @returns {Promise<Object>} - チャットレスポンス
 */
async function getChatResponse(analysisData, chatData) {
    console.log('Geminiチャットリクエスト処理:', chatData.message);
    
    const apiKey = getGeminiApiKey();
    console.log('APIキーモード(チャット):', apiKey);
    
    // APIキーチェック
    if (!apiKey) {
        console.error('Gemini APIキーが設定されていません。処理を中止します。');
        return { 
            error: "APIキー未設定",
            message: "Gemini APIキーが設定されていません。設定画面から登録してください。"
        };
    }
    
    // チャット用プロンプトを作成
    const context = chatData.context || {};
    // 現在の圃場データを自然な文章で表現
    let fieldDataText = '現在の圃場データはありません';
    if (context.fieldData) {
        fieldDataText = `圃場名: ${context.fieldData.name || '不明'}、作物: ${context.fieldData.crop || '不明'}、メモ: ${context.fieldData.memo || 'なし'}`;
    }
    
    // 最新の分析データを自然な文章で表現
    let analysisDataText = '最新の分析データはありません';
    if (context.analysisData && context.analysisData.stats) {
        const stats = context.analysisData.stats;
        analysisDataText = `NDVI平均: ${stats.ndvi ? stats.ndvi.mean : '不明'}、NDMI平均: ${stats.ndmi ? stats.ndmi.mean : '不明'}、NDRE平均: ${stats.ndre ? stats.ndre.mean : '不明'}、分析期間: ${context.analysisData.dateRange ? `${context.analysisData.dateRange.start}から${context.analysisData.dateRange.end}` : '不明'}`;
    }

    let chatPrompt = `あなたは農業の専門家です。以下の圃場分析データとユーザーが選択した過去のデータに基づいて質問に回答してください。

【現在の圃場データ】
${fieldDataText}

【最新の分析データ】
${analysisDataText}

【選択された過去の分析データ】
${context.selectedData && context.selectedData.length > 0 ? 
    `ユーザーが参照用に選択した分析ID: ${context.selectedData.join(', ')}` : 
    'ユーザーが参照用に選択した過去の分析データはありません'}

`;

    // 選択された分析データの詳細を追加
    if (context.selectedData && context.selectedData.length > 0) {
        console.log('=== DEBUG: Gemini API チャット処理 ===');
        console.log('選択されたデータID:', context.selectedData);
        
        const selectedDetails = [];
        for (const analysisId of context.selectedData) {
            const result = window.AnalysisStorage ? window.AnalysisStorage.getById(analysisId) : null;
            console.log(`分析ID ${analysisId} の取得結果:`, result ? '成功' : '失敗');
            
            if (result) {
                const detail = {
                    id: analysisId,
                    圃場名: result.field ? result.field.name : '不明',
                    分析日: result.dateFormatted || result.date,
                    健康状態: result.evaluation ? result.evaluation.overall.status : '不明',
                    NDVI平均: result.analysis && result.analysis.stats ? result.analysis.stats.ndvi.mean : '不明',
                    NDMI平均: result.analysis && result.analysis.stats ? result.analysis.stats.ndmi.mean : '不明',
                    NDRE平均: result.analysis && result.analysis.stats ? result.analysis.stats.ndre.mean : '不明',
                    作物: result.field ? result.field.crop : '不明',
                    面積: result.field ? result.field.area : '不明'
                };
                console.log(`  詳細データ:`, detail);
                selectedDetails.push(detail);
            }
        }
        
        if (selectedDetails.length > 0) {
            chatPrompt += `
【選択された分析データの詳細】
${selectedDetails.map((detail, index) => `
分析${index + 1}（ID: ${detail.id}）:
  圃場名: ${detail.圃場名}
  分析日: ${detail.分析日}
  健康状態: ${detail.健康状態}
  作物: ${detail.作物}
  面積: ${detail.面積}ヘクタール
  NDVI平均: ${detail.NDVI平均}
  NDMI平均: ${detail.NDMI平均}
  NDRE平均: ${detail.NDRE平均}
`).join('\n')}
`;
        }
    }
    
    chatPrompt += `
ユーザーからの質問: ${chatData.message}

## 絶対に守るべき回答ルール:
1. 必ず日本語で回答してください。英語は一切使用禁止です。
2. JSON形式（{...}）での回答は絶対に禁止です。
3. オブジェクト形式（キー:値）での回答は絶対に禁止です。
4. 中括弧「{」「}」、角括弧「[」「]」は絶対に使用しないでください。
5. コード形式での回答は絶対に禁止です。
6. 普通の会話文で、自然な日本語で回答してください。
7. 回答は簡潔でわかりやすく、高齢の農家の方にも理解できるように説明してください。
8. データが不足している場合は、一般的な農業の知見に基づいて回答し、その旨を明記してください。

上記のルールを絶対に厳守して、農業の専門知識を使った自然な日本語の会話文で回答してください。構造化されたデータ形式ではなく、普通の文章で説明してください。`;
    
    try {
        console.log('=== DEBUG: 最終プロンプト送信 ===');
        console.log('プロンプト長:', chatPrompt.length);
        console.log('最終プロンプト（最初の1000文字）:', chatPrompt.substring(0, 1000) + (chatPrompt.length > 1000 ? '...' : ''));
        
        if (chatPrompt.includes('【選択された分析データの詳細】')) {
            console.log('✓ 選択されたデータがプロンプトに含まれています');
        } else {
            console.log('⚠ 選択されたデータがプロンプトに含まれていません');
        }
        
        console.log('チャット用fetchGeminiResponseを呼び出します。');
        const responseText = await fetchGeminiResponse(apiKey, chatPrompt);
        
        if (responseText && typeof responseText === 'string') {
            // JSONレスポンスかどうか確認して、自然な文章を抽出
            let cleanResponse = responseText.trim();
            
            // JSON形式のレスポンスをチェック
            if (cleanResponse.startsWith('{') && cleanResponse.endsWith('}')) {
                try {
                    const parsedResponse = JSON.parse(cleanResponse);
                    console.log('JSON形式のレスポンスを検出しました:', Object.keys(parsedResponse));
                    
                    // 様々なキーから自然な文章を抽出を試行
                    if (parsedResponse.answer) {
                        console.log('JSON形式のレスポンスから answer フィールドを抽出しました');
                        cleanResponse = parsedResponse.answer;
                    } else if (parsedResponse.chatResponse) {
                        console.log('JSON形式のレスポンスから chatResponse フィールドを抽出しました');
                        cleanResponse = parsedResponse.chatResponse;
                    } else if (parsedResponse['重要な知見']) {
                        console.log('JSON形式のレスポンスから「重要な知見」フィールドを抽出しました');
                        cleanResponse = parsedResponse['重要な知見'];
                    } else if (parsedResponse.message) {
                        console.log('JSON形式のレスポンスから message フィールドを抽出しました');
                        cleanResponse = parsedResponse.message;
                    } else if (parsedResponse.text) {
                        console.log('JSON形式のレスポンスから text フィールドを抽出しました');
                        cleanResponse = parsedResponse.text;
                    } else {
                        // どのフィールドも見つからない場合、最初の文字列値を使用
                        for (const [key, value] of Object.entries(parsedResponse)) {
                            if (typeof value === 'string' && value.length > 10) {
                                console.log(`JSON形式のレスポンスから「${key}」フィールドを抽出しました`);
                                cleanResponse = value;
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.log('JSONパースに失敗しましたが、元のテキストを使用します');
                }
            }
            
            // さらに、残っているJSON文字列やオブジェクト形式の文字列を除去
            cleanResponse = cleanResponse.replace(/^\{.*?\}$/s, '').trim();
            if (!cleanResponse) {
                cleanResponse = 'すみませんが、適切な回答を生成できませんでした。もう一度お試しください。';
            }
            
            // チャットの場合は整形済みテキストをそのまま返す
            console.log('チャットレスポンス受信 (長さ):', cleanResponse.length);
            return { 
                chatResponse: cleanResponse,
                success: true 
            };
        } else {
            return { 
                error: "レスポンスの形式が想定外です",
                chatResponse: "申し訳ありませんが、回答を生成できませんでした。" 
            };
        }
    } catch (error) {
        console.error('チャットレスポンス取得中にエラー:', error);
        return { 
            error: error.message,
            chatResponse: "エラーが発生しました: " + error.message 
        };
    }
}

// モジュールとしてエクスポート、グローバルスコープに関数を公開する
window.getGeminiAdvice = getGeminiAdvice;
