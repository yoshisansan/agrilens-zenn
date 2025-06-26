// AI アシスタントモジュール
// 圃場データや履歴に基づいて質問に答えるインライン型アシスタント

// 質問と回答の履歴を保存
let questionHistory = [];

// AIアシスタントの初期化
function initializeAiAssistant() {
    console.log('AIアシスタントを初期化しています...');
    
    // Dashboard Chat Send ボタンのイベントリスナー設定
    const dashboardSendButton = document.getElementById('dashboardChatSend');
    if (dashboardSendButton) {
        dashboardSendButton.addEventListener('click', handleDashboardChatSubmit);
    }
    
    // Dashboard Chat Input のEnterキーイベント
    const dashboardChatInput = document.getElementById('dashboardChatInput');
    if (dashboardChatInput) {
        dashboardChatInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleDashboardChatSubmit();
            }
        });
    }
    
    // Dashboard Chat Clear ボタンのイベントリスナー設定
    const dashboardClearButton = document.getElementById('dashboardChatClear');
    if (dashboardClearButton) {
        dashboardClearButton.addEventListener('click', clearDashboardChat);
    }
    
    // ローカルストレージから過去の質問履歴を復元
    loadQuestionHistory();
    
    console.log('AIアシスタントの初期化が完了しました');
}

// Dashboard Chat 送信処理
async function handleDashboardChatSubmit() {
    const chatInput = document.getElementById('dashboardChatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // ユーザーメッセージを表示
    showDashboardUserMessage(message);
    
    // 入力フィールドをクリア
    chatInput.value = '';
    
    // AIの「考え中」メッセージを表示
    const thinkingId = showDashboardThinkingMessage();
    
    try {
        // 選択されたデータを含むプロンプトを作成
        const selectedIds = window.AiAssistantHistory ? window.AiAssistantHistory.getSelectedIds() : [];
        const fullPrompt = window.AiAssistantHistory ? 
            window.AiAssistantHistory.createPrompt(message) : message;
        
        console.log('=== DEBUG: AI質問送信処理 ===');
        console.log('元の質問:', message);
        console.log('選択された分析ID:', selectedIds);
        console.log('選択されたIDの数:', selectedIds.length);
        
        if (selectedIds.length > 0) {
            console.log('=== 選択されたデータの詳細 ===');
            selectedIds.forEach(id => {
                const result = window.AnalysisStorage ? window.AnalysisStorage.getById(id) : null;
                console.log(`ID ${id}:`, result ? '取得成功' : '取得失敗');
                if (result) {
                    console.log(`  - 圃場名: ${result.field.name}`);
                    console.log(`  - 分析日: ${result.dateFormatted}`);
                    console.log(`  - NDVI平均: ${result.analysis.stats.ndvi.mean}`);
                }
            });
        }
        
        console.log('=== 完全なプロンプト（最初の500文字）===');
        console.log(fullPrompt.substring(0, 500) + (fullPrompt.length > 500 ? '...' : ''));
        console.log('プロンプト全体の長さ:', fullPrompt.length);
        
        // AIレスポンスを生成（チャット形式）
        console.log('🤖 AIレスポンス生成を開始します...');
        let response = await generateDashboardChatResponse(message, fullPrompt);
        
        // 「考え中」メッセージを削除
        removeDashboardThinkingMessage(thinkingId);
        
        // レスポンスがJSON形式の場合、自然な文章に変換
        response = cleanupAiResponse(response);
        
        // レスポンスの種類を判定
        const isRealAI = !response.includes('モックレスポンス') && 
                        !response.includes('ダミーデータ') && 
                        !response.includes('API利用不可時');
                        
        if (isRealAI) {
            console.log('✅ 実際のAIから回答を取得しました');
        } else {
            console.log('⚠️ ダミーレスポンスを使用しています');
        }
        
        // AIの返信を表示
        await showDashboardAiMessage(response, isRealAI);
        
        // 履歴を保存
        questionHistory.push({ question: message, answer: response, timestamp: new Date().toISOString() });
        saveQuestionHistory();
    } catch (error) {
        console.error('AIレスポンス生成エラー:', error);
        
        // 「考え中」メッセージを削除
        removeDashboardThinkingMessage(thinkingId);
        
        // エラーメッセージを表示
        await showDashboardAiMessage('すみません、エラーが発生しました。しばらくしてからもう一度お試しください。');
    }
}

// Dashboard Chat専用のAIレスポンス生成
async function generateDashboardChatResponse(userMessage, fullPrompt = null) {
    try {
        // 現在のフィールドデータと分析データを取得
        const fieldData = getCurrentFieldData();
        const analysisData = getLatestAnalysisData();
        
        // チャット用プロンプトを準備
        const prompt = fullPrompt ? 
            prepareChatPromptWithContext(fullPrompt, fieldData, analysisData) :
            prepareChatPrompt(userMessage, fieldData, analysisData);
        
        // Gemini APIのgemini-api.jsモジュールを使用（チャットモード）
        if (window.getGeminiAdvice && typeof window.getGeminiAdvice === 'function') {
            console.log('getGeminiAdviceを使用してGemini APIを呼び出します（チャットモード）');
            
            // チャットモード用のデータ構造を作成
            const chatData = {
                type: 'chat',
                message: prompt,
                context: {
                    fieldData: fieldData,
                    analysisData: analysisData,
                    userQuestion: userMessage,
                    selectedData: window.AiAssistantHistory ? window.AiAssistantHistory.getSelectedIds() : []
                }
            };
            
            const geminiResponse = await window.getGeminiAdvice(null, chatData);
            
            if (geminiResponse && geminiResponse.success && geminiResponse.chatResponse) {
                console.log('Gemini APIからのレスポンス取得成功');
                return geminiResponse.chatResponse;
            } else if (geminiResponse && geminiResponse.chatResponse) {
                console.log('Gemini APIからレスポンスを取得しましたがエラーフラグあり:', geminiResponse.error);
                return geminiResponse.chatResponse;
            } else {
                console.warn('Gemini APIからの不正なレスポンス形式:', geminiResponse);
                throw new Error('Gemini APIからの不正なレスポンス');
            }
        } else {
            console.warn('getGeminiAdvice関数が見つかりません。gemini-api.jsが読み込まれていない可能性があります');
            throw new Error('Gemini API関数が利用できません');
        }
    } catch (error) {
        console.error('Gemini API呼び出しエラー:', error);
        // エラー時はモックレスポンスを使用
        return generateMockChatResponse(userMessage, getCurrentFieldData(), getLatestAnalysisData());
    }
}

// チャット用プロンプトを準備
function prepareChatPrompt(userMessage, fieldData, analysisData) {
    let basePrompt = `
あなたは農業の専門家AIアシスタントです。ユーザーの質問に対して、農業や圃場管理の知識を活用して回答してください。
質問は日本語で回答してください。回答は簡潔かつ具体的にし、専門用語を使う場合は説明を加えてください。
高齢の農家の方にもわかりやすく説明することを心がけてください。

## 現在の圃場データ:
`;

    // 圃場データがある場合は追加
    if (fieldData) {
        basePrompt += `
- 圃場名: ${fieldData.name || '不明'}
- 作物: ${fieldData.crop || '不明'}
- メモ: ${fieldData.memo || 'なし'}
`;
    } else {
        basePrompt += `- 選択されている圃場はありません\n`;
    }

    // 分析データがある場合は追加
    if (analysisData && analysisData.stats) {
        const stats = analysisData.stats;
        basePrompt += `
## 植生指標データ:
- NDVI（植生指標）: ${stats.ndvi.mean}（最小: ${stats.ndvi.min}、最大: ${stats.ndvi.max}、標準偏差: ${stats.ndvi.stdDev}）
- NDMI（水分指標）: ${stats.ndmi.mean}（最小: ${stats.ndmi.min}、最大: ${stats.ndmi.max}、標準偏差: ${stats.ndmi.stdDev}）
- NDRE（栄養指標）: ${stats.ndre.mean}（最小: ${stats.ndre.min}、最大: ${stats.ndre.max}、標準偏差: ${stats.ndre.stdDev}）
- 日付範囲: ${analysisData.dateRange ? `${analysisData.dateRange.start} ～ ${analysisData.dateRange.end}` : '不明'}

## 指標の意味:
- NDVI: 植物の光合成活性と全体的な生育状況を示す（高いほど良い: >0.6が良好、<0.4が要注意）
- NDMI: 植物の水分ストレスと水分状態を評価する（高いほど良い: >0.3が良好、<0.1が要注意）
- NDRE: 窒素含有量など栄養状態を評価する（高いほど良い: >0.2が良好、<0.1が要注意）
`;
    } else {
        basePrompt += `\n## 植生指標データ:\n- 分析データはまだありません\n`;
    }

    // ユーザーメッセージを追加
    basePrompt += `\n## ユーザーの質問:\n${userMessage}\n`;

    // 回答指示を追加
    basePrompt += `
## 絶対に守るべき回答ルール:
1. 必ず日本語で回答してください。英語は一切使用禁止です。
2. JSON形式（{...}）での回答は絶対に禁止です。
3. オブジェクト形式（キー:値）での回答は絶対に禁止です。
4. 中括弧「{」「}」、角括弧「[」「]」は絶対に使用しないでください。
5. コード形式での回答は絶対に禁止です。
6. 普通の会話文で、自然な日本語で回答してください。
7. 回答は簡潔でわかりやすく、高齢の農家の方にも理解できるように説明してください。
8. データがない場合は「データがありません」と正直に伝え、ユーザーに分析実行を促してください。

上記のルールを絶対に厳守して、農業の専門知識を使った自然な日本語の会話文で回答してください。構造化されたデータ形式ではなく、普通の文章で説明してください。`;

    return basePrompt;
}

// 選択された分析データを含むチャット用プロンプトを準備
function prepareChatPromptWithContext(fullPrompt, fieldData, analysisData) {
    let prompt = `あなたは農業の専門家AIアシスタントです。ユーザーが選択した過去の分析データと現在の情報に基づいて質問に回答してください。
質問は日本語で回答してください。回答は簡潔かつ具体的にし、専門用語を使う場合は説明を加えてください。
高齢の農家の方にもわかりやすく説明することを心がけてください。

## 現在の圃場データ:
`;
    
    // 現在の圃場データがあれば追加
    if (fieldData) {
        prompt += `
- 圃場名: ${fieldData.name || '不明'}
- 作物: ${fieldData.crop || '不明'}
- メモ: ${fieldData.memo || 'なし'}
`;
    } else {
        prompt += `- 選択されている圃場はありません\n`;
    }
    
    // 最新の分析データがあれば追加
    if (analysisData && analysisData.stats) {
        const stats = analysisData.stats;
        prompt += `
## 最新の分析データ:
- NDVI（植生指標）: ${stats.ndvi.mean}（最小: ${stats.ndvi.min}、最大: ${stats.ndvi.max}、標準偏差: ${stats.ndvi.stdDev}）
- NDMI（水分指標）: ${stats.ndmi.mean}（最小: ${stats.ndmi.min}、最大: ${stats.ndmi.max}、標準偏差: ${stats.ndmi.stdDev}）
- NDRE（栄養指標）: ${stats.ndre.mean}（最小: ${stats.ndre.min}、最大: ${stats.ndre.max}、標準偏差: ${stats.ndre.stdDev}）
- 日付範囲: ${analysisData.dateRange ? `${analysisData.dateRange.start} ～ ${analysisData.dateRange.end}` : '不明'}
`;
    } else {
        prompt += `\n## 最新の分析データ:\n- 分析データはまだありません\n`;
    }
    
    // 選択された過去のデータを含む完全なプロンプトを追加
    prompt += fullPrompt + '\n\n';
    
    // 指示
    prompt += `
## 絶対に守るべき回答ルール:
1. 必ず日本語で回答してください。英語は一切使用禁止です。
2. JSON形式（{...}）での回答は絶対に禁止です。
3. オブジェクト形式（キー:値）での回答は絶対に禁止です。
4. 中括弧「{」「}」、角括弧「[」「]」は絶対に使用しないでください。
5. コード形式での回答は絶対に禁止です。
6. 普通の会話文で、自然な日本語で回答してください。
7. 回答は簡潔でわかりやすく、高齢の農家の方にも理解できるように説明してください。
8. 複数の分析データがある場合は、それらを比較分析して傾向や変化を説明してください。
9. データが不足している場合は、一般的な知見に基づいて回答し、その旨を明記してください。

上記のルールを絶対に厳守して、農業の専門知識を使った自然な日本語の会話文で回答してください。構造化されたデータ形式ではなく、普通の文章で説明してください。`;
    
    return prompt;
}

// AI回答を生成する
async function generateAiResponse(question, fullPrompt = null) {
    console.log('AI回答生成開始:', question);
    console.log('完全なプロンプト使用:', !!fullPrompt);
    
    // 現在のフィールドデータと分析データを取得
    const fieldData = getCurrentFieldData();
    const analysisData = getLatestAnalysisData();
    
    try {
        // 完全なプロンプトが渡されている場合はそれを使用、そうでなければ従来通り
        const prompt = fullPrompt ? 
            prepareAiPromptWithContext(fullPrompt, fieldData, analysisData) :
            prepareAiPrompt(question, fieldData, analysisData);
        
        console.log('最終プロンプト:', prompt.substring(0, 200) + '...');
        
        // Gemini APIのgemini-api.jsモジュールを使用
        if (window.getGeminiAdvice && typeof window.getGeminiAdvice === 'function') {
            console.log('getGeminiAdviceを使用してGemini APIを呼び出します');
            
            // チャットモード用のデータ構造を作成
            const chatData = {
                type: 'chat',
                message: prompt,
                context: {
                    fieldData: fieldData,
                    analysisData: analysisData,
                    userQuestion: question,
                    selectedData: window.AiAssistantHistory ? window.AiAssistantHistory.getSelectedIds() : []
                }
            };
            
            const geminiResponse = await window.getGeminiAdvice(null, chatData);
            
            if (geminiResponse && geminiResponse.success && geminiResponse.chatResponse) {
                console.log('Gemini APIからのレスポンス取得成功');
                return geminiResponse.chatResponse;
            } else if (geminiResponse && geminiResponse.chatResponse) {
                console.log('Gemini APIからレスポンスを取得しましたがエラーフラグあり:', geminiResponse.error);
                return geminiResponse.chatResponse;
            } else {
                console.warn('Gemini APIからの不正なレスポンス形式:', geminiResponse);
                throw new Error('Gemini APIからの不正なレスポンス');
            }
        } else {
            console.warn('getGeminiAdvice関数が見つかりません。gemini-api.jsが読み込まれていない可能性があります');
            throw new Error('Gemini API関数が利用できません');
        }
    } catch (error) {
        console.error('Gemini API呼び出しエラー:', error);
        // エラー時はモックレスポンスを使用
        return generateMockResponse(question, fieldData, analysisData);
    }
}

// プロンプトを準備する
function prepareAiPrompt(question, fieldData, analysisData) {
    let prompt = `あなたは農業AIアシスタントです。以下の情報に基づいて質問に回答してください。\n\n`;
    
    // 圃場データがあれば追加
    if (fieldData) {
        prompt += `【圃場情報】\n`;
        prompt += `名前: ${fieldData.name || '不明'}\n`;
        prompt += `位置: 緯度${fieldData.lat || '不明'}、経度${fieldData.lng || '不明'}\n`;
        prompt += `面積: ${fieldData.area || '不明'} m²\n`;
        prompt += `作物: ${fieldData.crop || '不明'}\n\n`;
    }
    
    // 分析データがあれば追加
    if (analysisData) {
        prompt += `【最新の分析データ】\n`;
        
        if (analysisData.ndvi) {
            prompt += `NDVI (植生指標): 平均${analysisData.ndvi.mean || '不明'}、最小${analysisData.ndvi.min || '不明'}、最大${analysisData.ndvi.max || '不明'}\n`;
        }
        
        if (analysisData.evi) {
            prompt += `EVI: 平均${analysisData.evi.mean || '不明'}、最小${analysisData.evi.min || '不明'}、最大${analysisData.evi.max || '不明'}\n`;
        }
        
        if (analysisData.ndwi) {
            prompt += `NDWI (水分指標): 平均${analysisData.ndwi.mean || '不明'}、最小${analysisData.ndwi.min || '不明'}、最大${analysisData.ndwi.max || '不明'}\n`;
        }
        
        if (analysisData.date) {
            prompt += `分析日: ${analysisData.date}\n`;
        }
        
        prompt += `\n`;
    }
    
    // 質問を追加
    prompt += `【質問】\n${question}\n\n`;
    
    // 指示
    prompt += `以上の情報を元に、簡潔かつ具体的に農業の専門知識を使って回答してください。データが不足している場合は、一般的な知見に基づいて回答し、その旨を明記してください。`;
    
    return prompt;
}

// 選択された分析データを含む拡張プロンプトを準備する
function prepareAiPromptWithContext(fullPrompt, fieldData, analysisData) {
    let prompt = `あなたは農業AIアシスタントです。ユーザーが選択した過去の分析データと現在の情報に基づいて質問に回答してください。\n\n`;
    
    // 現在の圃場データがあれば追加
    if (fieldData) {
        prompt += `【現在の圃場情報】\n`;
        prompt += `名前: ${fieldData.name || '不明'}\n`;
        prompt += `位置: 緯度${fieldData.lat || '不明'}、経度${fieldData.lng || '不明'}\n`;
        prompt += `面積: ${fieldData.area || '不明'} m²\n`;
        prompt += `作物: ${fieldData.crop || '不明'}\n\n`;
    }
    
    // 最新の分析データがあれば追加
    if (analysisData) {
        prompt += `【最新の分析データ】\n`;
        
        if (analysisData.ndvi) {
            prompt += `NDVI (植生指標): 平均${analysisData.ndvi.mean || '不明'}、最小${analysisData.ndvi.min || '不明'}、最大${analysisData.ndvi.max || '不明'}\n`;
        }
        
        if (analysisData.evi) {
            prompt += `EVI: 平均${analysisData.evi.mean || '不明'}、最小${analysisData.evi.min || '不明'}、最大${analysisData.evi.max || '不明'}\n`;
        }
        
        if (analysisData.ndwi) {
            prompt += `NDWI (水分指標): 平均${analysisData.ndwi.mean || '不明'}、最小${analysisData.ndwi.min || '不明'}、最大${analysisData.ndwi.max || '不明'}\n`;
        }
        
        if (analysisData.date) {
            prompt += `分析日: ${analysisData.date}\n`;
        }
        
        prompt += `\n`;
    }
    
    // 選択された過去のデータを含む完全なプロンプトを追加
    prompt += fullPrompt + '\n\n';
    
    // 指示
    prompt += `以上の現在の情報と選択された過去の分析データを総合的に判断して、農業の専門知識を使って自然な日本語のテキストで回答してください。JSON形式ではなく、普通の会話文で回答してください。複数の分析データがある場合は、それらを比較分析して傾向や変化を説明してください。データが不足している場合は、一般的な知見に基づいて回答し、その旨を明記してください。`;
    
    return prompt;
}

// モックレスポンスを生成（API利用不可時のフォールバック）
function generateMockResponse(question, fieldData, analysisData) {
    // 質問の内容に基づいて、ある程度関連性のある回答を返す
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('作物') || lowerQuestion.includes('栽培')) {
        return '現在の土壌状態と気候条件を考慮すると、この圃場には小麦、大豆、または野菜（特にキャベツ、ニンジン）が適しているでしょう。正確な推奨には、より詳細な土壌分析データが必要です。';
    }
    
    if (lowerQuestion.includes('水') || lowerQuestion.includes('灌漑') || lowerQuestion.includes('かんがい')) {
        return 'NDWIの値から判断すると、現在の圃場の水分状態は適切な範囲内にあります。ただし、今後1週間の天気予報では雨が少ないため、3〜4日後には灌漑を検討されることをお勧めします。';
    }
    
    if (lowerQuestion.includes('病気') || lowerQuestion.includes('害虫')) {
        return '衛星画像からは植生の不均一性がわずかに見られますが、これが病害虫によるものかどうかは現地確認が必要です。南東部分のNDVI値が他の部分より低くなっているため、その区域を重点的に調査することをお勧めします。';
    }
    
    if (lowerQuestion.includes('肥料') || lowerQuestion.includes('施肥')) {
        return '衛星データから見る限り、植生状態は標準的ですが、成長期に入る前に窒素肥料の追加を検討されることをお勧めします。土壌サンプルを採取して、より正確な肥料推奨を得ることも有効です。';
    }
    
    if (lowerQuestion.includes('収穫') || lowerQuestion.includes('収量')) {
        return '現在のEVIおよびNDVI値から推定すると、平均的な気象条件が続いた場合、この圃場からは約X〜Yトン/haの収量が期待できます。ただし、これは一般的な推定値であり、作物の種類や管理方法によって変動します。';
    }
    
    // デフォルトの回答
    return '申し訳ありませんが、その質問に回答するには追加情報が必要です。圃場の具体的な状況（作物の種類、成長段階、最近の気象条件など）を教えていただけると、より具体的なアドバイスが可能です。';
}

// 現在の圃場データを取得
function getCurrentFieldData() {
    // ここでフィールドの管理モジュールからデータを取得
    // fields.jsなどの別モジュールが実装している場合に連携
    if (window.fieldsManager && typeof window.fieldsManager.getCurrentField === 'function') {
        return window.fieldsManager.getCurrentField();
    }
    
    // データがない場合はnullを返す
    return null;
}

// 最新の分析データを取得
function getLatestAnalysisData() {
    // グローバル変数から最新の分析データを取得
    return window.latestAnalysisData || null;
}





// 質問履歴をローカルストレージに保存
function saveQuestionHistory() {
    try {
        // 最新の10件のみ保存
        const historyToSave = questionHistory.slice(-10);
        localStorage.setItem('aiQuestionHistory', JSON.stringify(historyToSave));
    } catch (error) {
        console.error('質問履歴の保存に失敗しました:', error);
    }
}

// ローカルストレージから質問履歴を読み込み
function loadQuestionHistory() {
    try {
        const savedHistory = localStorage.getItem('aiQuestionHistory');
        if (savedHistory) {
            questionHistory = JSON.parse(savedHistory);
            
            // 保存されていた履歴を表示（ダッシュボードチャット形式）
            questionHistory.forEach(item => {
                showDashboardUserMessage(item.question);
                showDashboardAiMessage(item.answer, true); // 履歴は実際のAIレスポンスとして表示
            });
        }
    } catch (error) {
        console.error('質問履歴の読み込みに失敗しました:', error);
        questionHistory = [];
    }
}

// Dashboard Chatユーザーメッセージを表示
function showDashboardUserMessage(message) {
    const chatMessages = document.getElementById('dashboardChatMessages');
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message user-message';
    messageElement.innerHTML = `
        <div class="flex items-start justify-end">
            <div class="mr-3 bg-blue-100 rounded-lg py-2 px-3 max-w-[85%]">
                <p class="text-sm text-gray-800 whitespace-pre-wrap">${escapeHtml(message)}</p>
            </div>
            <div class="flex-shrink-0">
                <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <i class="fas fa-user text-blue-500"></i>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    
    // スクロールを一番下に
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Dashboard Chat AIメッセージを表示
async function showDashboardAiMessage(message, isRealAI = false) {
    const chatMessages = document.getElementById('dashboardChatMessages');
    if (!chatMessages) return;
    
    // メッセージをクリーンアップして整形
    const formattedMessage = formatMessageText(message);
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message ai-message';
    
    // AIの種類に応じたアイコンとスタイルを設定
    const aiIcon = isRealAI ? 'fas fa-robot' : 'fas fa-cog';
    const aiColor = isRealAI ? 'text-green-500' : 'text-orange-500';
    const bgColor = isRealAI ? 'bg-green-100' : 'bg-orange-50';
    const borderColor = isRealAI ? 'border-green-200' : 'border-orange-200';
    
    messageElement.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <div class="w-8 h-8 rounded-full ${bgColor} flex items-center justify-center border ${borderColor}">
                    <i class="${aiIcon} ${aiColor}"></i>
                </div>
            </div>
            <div class="ml-3 ${bgColor} rounded-lg py-2 px-3 max-w-[85%] border ${borderColor}">
                ${isRealAI ? '' : '<div class="text-xs text-orange-600 mb-1"><i class="fas fa-info-circle"></i> デモモード（ダミーレスポンス）</div>'}
                <div class="text-sm text-gray-800">${formattedMessage}</div>
                ${!isRealAI ? '<div class="text-xs text-orange-600 mt-1">実際のAI回答を使用するには、GEMINI_API_KEYを設定してください。</div>' : ''}
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    
    console.log('=== DEBUG: showDashboardAiMessage - おすすめ質問生成呼び出し ===');
    console.log('message長さ:', message?.length);
    
    // おすすめ質問コンポーネントを生成して追加
    try {
        await generateAndShowDashboardSuggestedQuestions(message);
    } catch (error) {
        console.error('おすすめ質問生成でエラー:', error);
    }
    
    // スクロールを一番下に
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Dashboard用おすすめの質問を生成して表示する関数
async function generateAndShowDashboardSuggestedQuestions(aiResponse) {
    console.log('=== DEBUG: generateAndShowDashboardSuggestedQuestions 開始 ===');
    console.log('aiResponse:', aiResponse?.substring(0, 100) + '...');
    
    try {
        // 現在の圃場データと分析データを取得
        const fieldData = getCurrentFieldData();
        const analysisData = getLatestAnalysisData();
        
        // 選択された分析データも取得
        const selectedAnalysisData = getSelectedAnalysisData();
        
        // 質問履歴の最後の質問を取得
        const lastUserQuestion = questionHistory.length > 0 ? 
            questionHistory[questionHistory.length - 1]?.question : '';
        
        console.log('=== DEBUG: おすすめ質問生成開始 ===');
        console.log('最後のユーザー質問:', lastUserQuestion);
        console.log('AI回答の長さ:', aiResponse?.length);
        console.log('現在の分析データ:', analysisData ? '有り' : '無し');
        console.log('選択された分析データ:', selectedAnalysisData ? `${selectedAnalysisData.length}件` : '無し');
        
        // おすすめ質問を生成（選択されたデータも含める）
        console.log('generateDashboardSuggestedQuestions 呼び出し開始');
        const suggestedQuestions = await generateDashboardSuggestedQuestions(lastUserQuestion, aiResponse, fieldData, analysisData, selectedAnalysisData);
        console.log('generateDashboardSuggestedQuestions 呼び出し完了:', suggestedQuestions);
        
        if (suggestedQuestions && suggestedQuestions.length > 0) {
            console.log('生成されたおすすめ質問:', suggestedQuestions);
            console.log('showDashboardSuggestedQuestionsComponent 呼び出し開始');
            showDashboardSuggestedQuestionsComponent(suggestedQuestions);
            console.log('showDashboardSuggestedQuestionsComponent 呼び出し完了');
        } else {
            console.log('おすすめ質問の生成に失敗しました - suggestedQuestions:', suggestedQuestions);
        }
    } catch (error) {
        console.error('Dashboard おすすめ質問の生成中にエラーが発生しました:', error);
        console.error('エラースタック:', error.stack);
    }
}

// Dashboard用おすすめ質問を生成する関数
async function generateDashboardSuggestedQuestions(userQuestion, aiResponse, fieldData, analysisData, selectedAnalysisData = null) {
    console.log('=== DEBUG: generateDashboardSuggestedQuestions 関数開始 ===');
    
    try {
        // プロンプトを作成（選択されたデータも含める）
        console.log('プロンプト作成開始');
        const prompt = createDashboardSuggestedQuestionsPrompt(userQuestion, aiResponse, fieldData, analysisData, selectedAnalysisData);
        console.log('プロンプト作成完了 - 長さ:', prompt.length);
        
        // Gemini APIを使用して質問を生成
        console.log('Gemini API呼び出し開始');
        const response = await fetchDashboardGeminiSuggestedQuestions(prompt);
        console.log('Gemini API呼び出し完了:', response);
        
        return response;
    } catch (error) {
        console.error('Dashboard おすすめ質問生成エラー:', error);
        console.error('エラースタック:', error.stack);
        console.log('デフォルト質問生成にフォールバック');
        const defaultQuestions = generateDefaultDashboardSuggestedQuestions(fieldData, analysisData);
        console.log('デフォルト質問:', defaultQuestions);
        return defaultQuestions;
    }
}

// Dashboard用おすすめ質問生成プロンプトを作成
function createDashboardSuggestedQuestionsPrompt(userQuestion, aiResponse, fieldData, analysisData, selectedAnalysisData = null) {
    let prompt = `
あなたは農業の専門家AIアシスタントです。ダッシュボードでの会話の流れを分析して、次に聞きたくなるであろう3つの質問を提案してください。

## 直前の会話:
ユーザーの質問: ${userQuestion || '初回質問'}
AIの回答: ${aiResponse}

## 現在の圃場データ:
`;

    // 圃場データがある場合は追加
    if (fieldData) {
        prompt += `
- 圃場名: ${fieldData.name || '不明'}
- 作物: ${fieldData.crop || '不明'}
- メモ: ${fieldData.memo || 'なし'}
`;
    } else {
        prompt += `- 選択されている圃場はありません\n`;
    }

    // 現在の分析データがある場合は追加
    if (analysisData && analysisData.stats) {
        const stats = analysisData.stats;
        prompt += `
## 最新の植生指標データ:
- NDVI（植生指標）: ${stats.ndvi ? stats.ndvi.mean : '不明'}
- NDMI（水分指標）: ${stats.ndmi ? stats.ndmi.mean : '不明'}
- NDRE（栄養指標）: ${stats.ndre ? stats.ndre.mean : '不明'}
`;
    } else {
        prompt += `\n## 最新の植生指標データ: まだ分析されていません\n`;
    }

    // 選択された分析データの詳細を追加
    if (selectedAnalysisData && selectedAnalysisData.length > 0) {
        prompt += `\n## 選択された過去の分析データ: ${selectedAnalysisData.length}件\n`;
        
        selectedAnalysisData.forEach((data, index) => {
            const stats = data.analysis?.stats || data.stats;
            const evaluation = data.analysis?.evaluation || data.evaluation;
            prompt += `
### 選択データ${index + 1}:
- 圃場名: ${data.field?.name || '不明'}
- 分析日: ${data.dateFormatted || data.date || '不明'}
- NDVI: ${stats?.ndvi?.mean || '不明'}
- NDMI: ${stats?.ndmi?.mean || '不明'}
- NDRE: ${stats?.ndre?.mean || '不明'}
- 健康状態: ${evaluation?.overall?.status || '不明'}
`;
        });
    } else {
        prompt += `\n## 選択された分析データ: なし\n`;
    }

    prompt += `
## 回答要求:
上記の情報を基に、農家が次に知りたくなるであろう実用的で具体的な質問を3つ提案してください。
質問は以下の条件を満たしてください：
1. 各質問は30文字以内で簡潔に
2. 農業の実践に役立つ内容
3. 現在のデータや会話の流れに関連している
4. 初心者にも理解しやすい表現
5. 複数の分析データが選択されている場合は、比較や時系列変化に関する質問も含める

回答は以下のJSON形式で返してください：
{
  "questions": [
    "質問1",
    "質問2", 
    "質問3"
  ]
}
`;

    return prompt;
}

// Dashboard用Gemini APIを使っておすすめ質問を取得
async function fetchDashboardGeminiSuggestedQuestions(prompt) {
    try {
        // gemini-api.jsのgetGeminiAdvice関数を使用（チャットモード）
        const chatData = {
            type: 'suggested_questions',
            message: prompt,
            context: {
                fieldData: getCurrentFieldData(),
                analysisData: getLatestAnalysisData(),
                selectedData: window.AiAssistantHistory ? window.AiAssistantHistory.getSelectedIds() : []
            }
        };
        
        const response = await window.getGeminiAdvice(null, chatData);
        
        if (response && response.success && response.chatResponse) {
            // JSONレスポンスを解析
            try {
                const parsedResponse = JSON.parse(response.chatResponse);
                if (parsedResponse.questions && Array.isArray(parsedResponse.questions)) {
                    return parsedResponse.questions.slice(0, 3); // 最大3つ
                }
            } catch (parseError) {
                console.warn('Dashboard JSON解析に失敗、デフォルト質問を使用:', parseError);
            }
        }
        
        return generateDefaultDashboardSuggestedQuestions(getCurrentFieldData(), getLatestAnalysisData());
    } catch (error) {
        console.error('Dashboard Gemini APIでおすすめ質問取得に失敗:', error);
        return generateDefaultDashboardSuggestedQuestions(getCurrentFieldData(), getLatestAnalysisData());
    }
}

// 選択された分析データを取得する関数
function getSelectedAnalysisData() {
    try {
        // AiAssistantHistoryオブジェクトの存在確認
        console.log('=== DEBUG: AiAssistantHistory チェック ===');
        console.log('window.AiAssistantHistory:', typeof window.AiAssistantHistory);
        console.log('AiAssistantHistory.getSelectedIds:', typeof window.AiAssistantHistory?.getSelectedIds);
        
        const selectedIds = window.AiAssistantHistory ? window.AiAssistantHistory.getSelectedIds() : [];
        console.log('=== DEBUG: 選択された分析データ取得 ===');
        console.log('選択されたID数:', selectedIds.length);
        console.log('選択されたID:', selectedIds);
        
        // HTML要素の存在確認
        const checkboxContainer = document.getElementById('aiHistoryCheckboxes');
        const selectedCount = document.getElementById('selectedAnalysisCount');
        console.log('チェックボックスコンテナ:', checkboxContainer ? '存在' : '不存在');
        console.log('選択カウント要素:', selectedCount ? `存在(値: ${selectedCount.textContent})` : '不存在');
        
        if (selectedIds.length === 0) {
            console.log('選択された分析データはありません');
            return null;
        }
        
        const selectedAnalysisDataList = [];
        for (const id of selectedIds) {
            const result = window.AnalysisStorage ? window.AnalysisStorage.getById(id) : null;
            console.log(`ID ${id} の取得結果:`, result ? '成功' : '失敗');
            if (result) {
                selectedAnalysisDataList.push(result);
                console.log(`  - 圃場名: ${result.field?.name}`);
                console.log(`  - 分析日: ${result.dateFormatted}`);
                console.log(`  - NDVI平均: ${result.analysis?.stats?.ndvi?.mean}`);
                console.log(`  - データ構造:`, {
                    analysis: result.analysis ? '有り' : '無し',
                    stats: result.analysis?.stats ? '有り' : '無し',
                    directStats: result.stats ? '有り' : '無し'
                });
            }
        }
        
        console.log('取得できた分析データ数:', selectedAnalysisDataList.length);
        return selectedAnalysisDataList.length > 0 ? selectedAnalysisDataList : null;
    } catch (error) {
        console.error('選択された分析データの取得でエラー:', error);
        return null;
    }
}

// Dashboard用デフォルトのおすすめ質問を生成
function generateDefaultDashboardSuggestedQuestions(fieldData, analysisData) {
    const defaultQuestions = [];
    
    // まず選択された分析データを確認
    const selectedAnalysisData = getSelectedAnalysisData();
    console.log('=== DEBUG: おすすめ質問生成 ===');
    console.log('現在の分析データ:', analysisData ? '有り' : '無し');
    console.log('選択された分析データ:', selectedAnalysisData ? `${selectedAnalysisData.length}件` : '無し');
    
    // 選択された分析データがある場合はそれを優先的に使用
    let targetAnalysisData = null;
    if (selectedAnalysisData && selectedAnalysisData.length > 0) {
        // 最新の選択データを使用
        const rawData = selectedAnalysisData[selectedAnalysisData.length - 1];
        console.log('選択された分析データを使用:', rawData.field?.name);
        console.log('選択されたデータの構造:', {
            analysis: rawData.analysis ? '有り' : '無し',
            stats: rawData.analysis?.stats ? '有り' : '無し',
            directStats: rawData.stats ? '有り' : '無し'
        });
        
        // 分析データのstatsは analysis.stats の下にある
        if (rawData.analysis && rawData.analysis.stats) {
            targetAnalysisData = rawData.analysis;
        } else if (rawData.stats) {
            // 直接statsがある場合
            targetAnalysisData = rawData;
        }
    } else if (analysisData && analysisData.stats) {
        // 選択データがない場合は現在の分析データを使用
        targetAnalysisData = analysisData;
        console.log('現在の分析データを使用');
    }
    
    console.log('=== DEBUG: ターゲット分析データ確認 ===');
    console.log('targetAnalysisData:', targetAnalysisData);
    console.log('targetAnalysisData.stats:', targetAnalysisData?.stats);
    
    if (targetAnalysisData && targetAnalysisData.stats) {
        const stats = targetAnalysisData.stats;
        console.log('分析データの統計:', {
            ndvi: stats.ndvi?.mean,
            ndmi: stats.ndmi?.mean,
            ndre: stats.ndre?.mean
        });
        
        // 分析データがある場合の質問
        if (stats.ndvi && stats.ndvi.mean < 0.5) {
            defaultQuestions.push('植生改善の具体的な方法は？');
        }
        if (stats.ndmi && stats.ndmi.mean < 0.2) {
            defaultQuestions.push('効果的な灌漑タイミングは？');
        }
        if (stats.ndre && stats.ndre.mean < 0.15) {
            defaultQuestions.push('適切な施肥量を教えて');
        }
        
        // 複数の分析データが選択されている場合の比較質問
        if (selectedAnalysisData && selectedAnalysisData.length > 1) {
            defaultQuestions.push('選択したデータの比較結果は？');
            defaultQuestions.push('時系列での変化の傾向は？');
        }
        
        // 足りない分をランダムで補完
        const additionalQuestions = [
            'この時期の管理ポイントは？',
            '病害虫対策を教えて',
            '来年の計画はどう立てる？',
            '他の圃場との比較は？',
            '収量への影響はどのくらい？'
        ];
        
        while (defaultQuestions.length < 3 && additionalQuestions.length > 0) {
            const randomIndex = Math.floor(Math.random() * additionalQuestions.length);
            defaultQuestions.push(additionalQuestions.splice(randomIndex, 1)[0]);
        }
    } else {
        console.log('分析データがないため、基本的な質問を生成');
        // 分析データがない場合の基本的な質問
        defaultQuestions.push(
            '圃場の現在の状態は？',
            '分析データの見方を教えて',
            '今すぐできる改善策は？'
        );
    }
    
    console.log('生成されたデフォルト質問:', defaultQuestions);
    return defaultQuestions.slice(0, 3);
}

// Dashboard用おすすめ質問コンポーネントを表示
function showDashboardSuggestedQuestionsComponent(questions) {
    console.log('=== DEBUG: showDashboardSuggestedQuestionsComponent 開始 ===');
    console.log('questions:', questions);
    
    const chatMessages = document.getElementById('dashboardChatMessages');
    console.log('dashboardChatMessages要素:', chatMessages);
    
    if (!chatMessages) {
        console.error('dashboardChatMessages要素が見つかりません');
        return;
    }
    
    if (!questions || questions.length === 0) {
        console.log('質問が空またはnullです');
        return;
    }
    
    console.log('おすすめ質問要素を作成中...');
    const suggestedQuestionsElement = document.createElement('div');
    suggestedQuestionsElement.className = 'suggested-questions-container';
    
    try {
        suggestedQuestionsElement.innerHTML = `
            <div class="suggested-questions-header">
                <i class="fas fa-lightbulb text-yellow-500"></i>
                <span class="suggested-questions-title">次のおすすめ質問</span>
            </div>
            <div class="suggested-questions-buttons">
                ${questions.map((question, index) => `
                    <button 
                        class="suggested-question-btn" 
                        onclick="handleDashboardSuggestedQuestionClick('${escapeHtml(question)}')"
                        data-question="${escapeHtml(question)}"
                    >
                        ${escapeHtml(question)}
                    </button>
                `).join('')}
            </div>
        `;
        
        console.log('HTML生成完了、要素をDOMに追加中...');
        chatMessages.appendChild(suggestedQuestionsElement);
        console.log('おすすめ質問コンポーネントの表示完了');
        
    } catch (error) {
        console.error('おすすめ質問コンポーネントの作成中にエラー:', error);
        console.error('エラースタック:', error.stack);
    }
}

// Dashboard用おすすめ質問ボタンクリック時の処理
function handleDashboardSuggestedQuestionClick(question) {
    const chatInput = document.getElementById('dashboardChatInput');
    if (chatInput) {
        // 質問をテキストエリアに入力
        chatInput.value = question;
        chatInput.focus();
        
        // オプション: 自動的に送信する場合
        // handleDashboardChatSubmit();
    }
}

// Dashboard用おすすめ質問のクリックハンドラをグローバルに公開
window.handleDashboardSuggestedQuestionClick = handleDashboardSuggestedQuestionClick;

// Dashboard Chat AI考え中メッセージを表示（一意のIDを返す）
function showDashboardThinkingMessage() {
    const chatMessages = document.getElementById('dashboardChatMessages');
    if (!chatMessages) return null;
    
    const thinkingId = 'thinking-' + Date.now();
    const messageElement = document.createElement('div');
    messageElement.id = thinkingId;
    messageElement.className = 'chat-message ai-message thinking';
    messageElement.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <i class="fas fa-robot text-green-500"></i>
                </div>
            </div>
            <div class="ml-3 bg-green-100 rounded-lg py-2 px-3">
                <div class="flex space-x-1">
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                    <div class="typing-dot"></div>
                </div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    
    // スクロールを一番下に
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return thinkingId;
}

// Dashboard Chat考え中メッセージを削除
function removeDashboardThinkingMessage(thinkingId) {
    if (!thinkingId) return;
    
    const thinkingElement = document.getElementById(thinkingId);
    if (thinkingElement) {
        thinkingElement.remove();
    }
}

// Dashboard Chatのクリア
function clearDashboardChat() {
    console.log('Dashboard Chat履歴をクリアします');
    questionHistory = [];
    const chatMessages = document.getElementById('dashboardChatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
        // ウェルカムメッセージを再表示
        const welcomeMessage = document.createElement('div');
        welcomeMessage.className = 'chat-message ai-message';
        welcomeMessage.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <i class="fas fa-robot text-green-500"></i>
                    </div>
                </div>
                <div class="ml-3 bg-green-100 rounded-lg py-2 px-3 max-w-[85%]">
                    <p class="text-sm text-gray-800">こんにちは！農地分析AIアシスタントです。圃場データの分析や作物の健康状態について質問してください。</p>
                </div>
            </div>
        `;
        chatMessages.appendChild(welcomeMessage);
    }
    saveQuestionHistory();
}

// モックチャットレスポンス生成（AIチャットに基づく）
function generateMockChatResponse(userMessage, fieldData, analysisData) {
    console.log('⚠️ ダミーレスポンス生成中: Gemini APIが利用できないため、モックデータを使用しています');
    
    // 質問に含まれるキーワードに基づいて回答を生成
    const message = userMessage.toLowerCase();
    
    // NDVIについての質問
    if (message.includes('ndvi') || message.includes('植生指標') || message.includes('植生')) {
        if (analysisData && analysisData.stats && analysisData.stats.ndvi) {
            const ndviValue = analysisData.stats.ndvi.mean;
            let evaluation = '';
            
            if (ndviValue > 0.6) {
                evaluation = '非常に良好です。植物が健康で十分な葉の被覆があることを示しています。';
            } else if (ndviValue > 0.4) {
                evaluation = '普通です。まずまずの生育状況ですが、改善の余地があります。';
            } else {
                evaluation = '注意が必要です。植物の被覆が少ないか、健康状態に問題がある可能性があります。';
            }
            
            return `現在の圃場のNDVI値は ${ndviValue.toFixed(2)} で、これは${evaluation}`;
        } else {
            return 'NDVIデータがまだ分析されていません。マップ上で圃場を選択して「選択範囲を分析」ボタンをクリックしてください。';
        }
    }
    
    // 水分や水分ストレスについての質問
    else if (message.includes('水分') || message.includes('ndmi') || message.includes('水ストレス') || message.includes('乾燥')) {
        if (analysisData && analysisData.stats && analysisData.stats.ndmi) {
            const ndmiValue = analysisData.stats.ndmi.mean;
            let evaluation = '';
            
            if (ndmiValue > 0.3) {
                evaluation = '水分状態は非常に良好です。作物に十分な水分があります。';
            } else if (ndmiValue > 0.1) {
                evaluation = '水分状態はまずまずです。軽度の水分ストレスがある可能性があります。';
            } else {
                evaluation = '水分ストレスの兆候があります。灌漑を検討することをお勧めします。';
            }
            
            return `現在の圃場のNDMI（水分指標）値は ${ndmiValue.toFixed(2)} です。${evaluation}`;
        } else {
            return '水分指標（NDMI）のデータがまだ分析されていません。マップ上で圃場を選択して「選択範囲を分析」ボタンをクリックしてください。';
        }
    }
    
    // 栄養や肥料についての質問
    else if (message.includes('栄養') || message.includes('ndre') || message.includes('窒素') || message.includes('肥料')) {
        if (analysisData && analysisData.stats && analysisData.stats.ndre) {
            const ndreValue = analysisData.stats.ndre.mean;
            let evaluation = '';
            
            if (ndreValue > 0.2) {
                evaluation = '栄養状態は良好です。窒素含有量が適切なレベルにあります。';
            } else if (ndreValue > 0.1) {
                evaluation = '栄養状態は中程度です。追加の施肥を検討するとよいでしょう。';
            } else {
                evaluation = '栄養不足の可能性があります。窒素肥料の追加を検討してください。';
            }
            
            return `現在の圃場のNDRE（栄養指標）値は ${ndreValue.toFixed(2)} です。${evaluation}`;
        } else {
            return '栄養指標（NDRE）のデータがまだ分析されていません。マップ上で圃場を選択して「選択範囲を分析」ボタンをクリックしてください。';
        }
    }
    
    // 圃場状態の全般的な質問
    else if (message.includes('状態') || message.includes('健康') || message.includes('調子') || message.includes('様子') || message.includes('分析')) {
        if (analysisData && analysisData.stats) {
            const ndviValue = analysisData.stats.ndvi.mean;
            const ndmiValue = analysisData.stats.ndmi.mean;
            const ndreValue = analysisData.stats.ndre.mean;
            
            let overall = '';
            if (ndviValue > 0.6 && ndmiValue > 0.3 && ndreValue > 0.2) {
                overall = '全体的に非常に良好です';
            } else if (ndviValue > 0.4 && ndmiValue > 0.1 && ndreValue > 0.1) {
                overall = '全体的に普通ですが、一部改善の余地があります';
            } else {
                overall = '一部の指標で注意が必要です';
            }
            
            return `現在の圃場の状態は${overall}。NDVI（植生）: ${ndviValue.toFixed(2)}、NDMI（水分）: ${ndmiValue.toFixed(2)}、NDRE（栄養）: ${ndreValue.toFixed(2)}です。詳細な分析結果は分析タブで確認できます。`;
        } else {
            return 'まだ圃場の分析データがありません。マップ上で圃場を選択して「選択範囲を分析」ボタンをクリックすると、植生指標などの詳細な分析ができます。';
        }
    }
    
    // 作物や推奨に関する質問
    else if (message.includes('作物') || message.includes('育て') || message.includes('栽培') || message.includes('推奨') || message.includes('勧め')) {
        if (fieldData && fieldData.crop) {
            return `${fieldData.crop}の栽培についてですね。一般的に${fieldData.crop}は適切な水分と栄養管理が重要です。詳細な情報が必要であれば、どのような点について知りたいか具体的に質問してください。`;
        } else {
            return `作物の種類が設定されていないようです。圃場の詳細情報で作物の種類を設定すると、より具体的なアドバイスができます。一般的な栽培アドバイスが必要でしたら、具体的な作物名を質問に含めてください。`;
        }
    }
    
    // 一般的な農業や圃場管理の質問
    else {
        return `ご質問ありがとうございます。より具体的なアドバイスをするためには、圃場の分析データが役立ちます。マップ上で圃場を選択して「選択範囲を分析」ボタンをクリックすると、衛星データから詳細な情報が得られます。具体的な植生指標（NDVI）、水分指標（NDMI）、栄養指標（NDRE）についてお知りになりたい場合は、お気軽にお尋ねください。`;
    }
}

// メッセージテキストの整形（Markdownライクなフォーマットをサポート）
function formatMessageText(text) {
    if (!text) return '';
    
    // 前後のダブルクォーテーションを除去
    let cleanedText = text.toString().trim();
    if (cleanedText.startsWith('"') && cleanedText.endsWith('"')) {
        cleanedText = cleanedText.slice(1, -1);
    }
    
    // \n を実際の改行に変換（HTMLエスケープ前に実行）
    cleanedText = cleanedText.replace(/\\n/g, '\n');
    
    // HTMLエスケープ
    let formattedText = escapeHtml(cleanedText);
    
    // 改行を<br>タグに変換
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    // 見出し (##)
    formattedText = formattedText.replace(/^##\s+(.+)$/gm, '<h3 class="text-lg font-bold mt-2 mb-1">$1</h3>');
    
    // 強調 (**)
    formattedText = formattedText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // 箇条書き（改行後の処理として）
    formattedText = formattedText.replace(/^[*\-]\s+(.+)$/gm, '<li class="ml-4">• $1</li>');
    
    // 連続するliタグをulでラップ
    formattedText = formattedText.replace(/(<li[^>]*>.*?<\/li>(?:\s*<li[^>]*>.*?<\/li>)*)/g, '<ul class="space-y-1">$1</ul>');
    
    // 数値（緑色表示）
    formattedText = formattedText.replace(/(\b\d+\.\d+\b)/g, '<span class="text-green-600 font-medium">$1</span>');
    
    return formattedText;
}

// AIレスポンスのクリーンアップ関数
function cleanupAiResponse(response) {
    if (!response || typeof response !== 'string') {
        return response;
    }
    
    let cleanResponse = response.trim();
    
    // 前後のダブルクォーテーションを除去
    if (cleanResponse.startsWith('"') && cleanResponse.endsWith('"')) {
        cleanResponse = cleanResponse.slice(1, -1);
    }
    
    // JSON形式のレスポンスをチェック
    if (cleanResponse.startsWith('{') && cleanResponse.endsWith('}')) {
        try {
            const parsedResponse = JSON.parse(cleanResponse);
            console.log('JSON形式のレスポンスを検出、自然な文章に変換します:', Object.keys(parsedResponse));
            
            // 様々なキーから自然な文章を抽出を試行
            if (parsedResponse['重要な知見']) {
                console.log('「重要な知見」フィールドを抽出しました');
                cleanResponse = parsedResponse['重要な知見'];
            } else if (parsedResponse.answer) {
                console.log('answer フィールドを抽出しました');
                cleanResponse = parsedResponse.answer;
            } else if (parsedResponse.message) {
                console.log('message フィールドを抽出しました');
                cleanResponse = parsedResponse.message;
            } else if (parsedResponse.text) {
                console.log('text フィールドを抽出しました');
                cleanResponse = parsedResponse.text;
            } else if (parsedResponse.response) {
                console.log('response フィールドを抽出しました');
                cleanResponse = parsedResponse.response;
            } else {
                // どのフィールドも見つからない場合、最初の文字列値を使用
                for (const [key, value] of Object.entries(parsedResponse)) {
                    if (typeof value === 'string' && value.length > 10) {
                        console.log(`「${key}」フィールドを抽出しました`);
                        cleanResponse = value;
                        break;
                    }
                }
            }
        } catch (e) {
            console.log('JSONパースに失敗、元のテキストを使用します');
        }
    }
    
    // さらに、残っているJSON文字列やオブジェクト形式の文字列を除去
    cleanResponse = cleanResponse.replace(/^\{.*?\}$/s, '').trim();
    
    // 再度ダブルクォーテーション除去（抽出後）
    if (cleanResponse.startsWith('"') && cleanResponse.endsWith('"')) {
        cleanResponse = cleanResponse.slice(1, -1);
    }
    
    // \n を実際の改行に変換
    cleanResponse = cleanResponse.replace(/\\n/g, '\n');
    
    // 空の場合はフォールバックメッセージ
    if (!cleanResponse) {
        cleanResponse = 'すみませんが、適切な回答を生成できませんでした。もう一度質問してください。';
    }
    
    return cleanResponse;
}

// HTMLエスケープ関数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// エクスポート - グローバルオブジェクトに関数を公開
window.aiAssistant = {
    initialize: initializeAiAssistant,
    handleQuestion: handleDashboardChatSubmit
};
