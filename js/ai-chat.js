// AIチャットモジュール - 農地分析AIエージェント

// チャット履歴を保存する配列
let chatHistory = [];

// チャットUIの初期化
function initializeAiChat() {
    // チャットUIが既に表示されているか確認
    const chatContainer = document.getElementById('ai-chat-container');
    if (chatContainer) return;

    // チャットボタンのイベントリスナー
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    if (chatToggleBtn) {
        chatToggleBtn.addEventListener('click', toggleChatPanel);
    }

    // チャット送信ボタンのイベントリスナー
    const chatSendBtn = document.getElementById('chat-send-btn');
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', handleChatSubmit);
    }

    // チャット入力フィールドのEnterキーイベントリスナー
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleChatSubmit();
            }
        });
    }

    // 最初のウェルカムメッセージを表示
    showAiMessage('こんにちは！農地分析AIアシスタントです。圃場データの分析や作物の健康状態について質問してください。');
}

// チャットパネルの表示/非表示を切り替え
function toggleChatPanel() {
    console.log('toggleChatPanel called');
    
    const chatPanel = document.getElementById('ai-chat-panel');
    const chatToggleBtn = document.getElementById('chat-toggle-btn');
    
    console.log('chatPanel found:', !!chatPanel);

    if (chatPanel) {
        const isHidden = chatPanel.classList.contains('hidden');
        console.log('Chat panel is currently hidden:', isHidden);

        if (isHidden) {
            // パネルを表示
            showPanel(chatPanel, chatToggleBtn);
        } else {
            // パネルを非表示
            hidePanel(chatPanel, chatToggleBtn);
        }
    } else {
        console.error('Chat panel element not found');
    }
}

// パネルを表示する関数
function showPanel(chatPanel, chatToggleBtn) {
    console.log('Showing chat panel');
    chatPanel.classList.remove('hidden');
    chatToggleBtn.innerHTML = '<i class="fas fa-times"></i>';
    
    // チャットパネルが表示されたらスクロールを一番下に
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // 入力フィールドにフォーカス
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        chatInput.focus();
    }
}

// パネルを非表示にする関数
function hidePanel(chatPanel, chatToggleBtn) {
    console.log('Hiding chat panel');
    chatPanel.classList.add('hidden');
    chatToggleBtn.innerHTML = '<i class="fas fa-comment-dots"></i>';
}

// チャットパネルを直接閉じる関数（閉じるボタン用）
function closePanel() {
    console.log('closePanel called - 直接パネルを閉じます');
    
    const chatPanel = document.getElementById('ai-chat-panel');
    if (chatPanel) {
        console.log('チャットパネルを非表示にします');
        // 直接hiddenクラスを追加して非表示にする
        chatPanel.classList.add('hidden');
        
        // トグルボタンのアイコンを元に戻す
        const chatToggleBtn = document.getElementById('chat-toggle-btn');
        if (chatToggleBtn) {
            chatToggleBtn.innerHTML = '<i class="fas fa-comment-dots"></i>';
        }
        
        console.log('チャットパネルのクラスリスト:', chatPanel.classList);
    } else {
        console.error('Chat panel element not found');
    }
}

// チャット送信処理
async function handleChatSubmit() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // ユーザーメッセージを表示
    showUserMessage(message);
    
    // 入力フィールドをクリア
    chatInput.value = '';
    
    // AIの「考え中」メッセージを表示
    const thinkingId = showThinkingMessage();
    
    try {
        // AIレスポンスを生成
        const response = await generateAiResponse(message);
        
        // 「考え中」メッセージを削除
        removeThinkingMessage(thinkingId);
        
        // AIの返信を表示
        await showAiMessage(response);
    } catch (error) {
        console.error('AIレスポンス生成エラー:', error);
        
        // 「考え中」メッセージを削除
        removeThinkingMessage(thinkingId);
        
        // エラーメッセージを表示
        showAiMessage('すみません、エラーが発生しました。しばらくしてからもう一度お試しください。');
    }
}

// AIレスポンスを生成する関数
async function generateAiResponse(userMessage) {
    try {
        // 現在の圃場データと分析情報を取得
        const fieldData = getCurrentFieldData();
        const analysisData = getLatestAnalysisData();
        
        // プロンプトの準備（ユーザーのメッセージと圃場データを含む）
        const prompt = prepareAiPrompt(userMessage, fieldData, analysisData);
        
        // APIキーが設定されているか確認
        const apiKey = getGeminiApiKey();
        if (!apiKey) {
            console.warn('Gemini APIキーが設定されていません。モックレスポンスを返します。');
            return generateMockChatResponse(userMessage, fieldData, analysisData);
        }
        
        // Gemini APIによるレスポンス生成
        const response = await fetchGeminiChatResponse(apiKey, prompt, chatHistory);
        
        // チャット履歴の更新
        updateChatHistory(userMessage, response);
        
        return response;
    } catch (error) {
        console.error('AIレスポンス生成エラー:', error);
        return 'すみません、レスポンスの生成中にエラーが発生しました。別の質問をお試しください。';
    }
}

// チャット用のプロンプトを準備
function prepareAiPrompt(userMessage, fieldData, analysisData) {
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
    basePrompt += `\n回答は簡潔に、わかりやすくしてください。データがない場合は「データがありません」と正直に伝え、ユーザーに分析実行を促してください。`;

    return basePrompt;
}

// Gemini APIによるチャットレスポンスの取得
async function fetchGeminiChatResponse(apiKey, prompt, history) {
    // 統合AI APIのエンドポイント（Vertex AI対応）
    const apiEndpoint = '/api/ai-advice';
    
    // チャット履歴から最大5つの会話を取得
    const recentHistory = history.slice(-5);
    
    // 履歴をプロンプトに統合（Vertex AI形式）
    let fullPrompt = prompt;
    if (recentHistory.length > 0) {
        const historyText = recentHistory.map(item => 
            `${item.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${item.content}`
        ).join('\n');
        fullPrompt = `これまでの会話履歴:\n${historyText}\n\n現在の質問:\n${prompt}`;
    }
    
    const requestData = {
        prompt: fullPrompt,
        model: 'gemini-2.0-flash-thinking-exp-01-21' // 最新モデル
    };
    
    const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`AI API エラー: ${errorData.error || response.status}`);
    }
    
    const responseData = await response.json();
    
    // レスポンスから回答テキストを抽出
    if (responseData.success && responseData.result) {
        return responseData.result;
    }
    
    throw new Error('AI APIからの回答を解析できませんでした');
}

// モック（サンプル）チャットレスポンスの生成
function generateMockChatResponse(userMessage, fieldData, analysisData) {
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

// ユーザーメッセージを表示
function showUserMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message user-message';
    messageElement.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <i class="fas fa-user text-blue-500"></i>
                </div>
            </div>
            <div class="ml-3 bg-blue-100 rounded-lg py-2 px-3 max-w-[85%]">
                <p class="text-sm text-gray-800 whitespace-pre-wrap">${escapeHtml(message)}</p>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    
    // スクロールを一番下に
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// AIメッセージを表示
async function showAiMessage(message) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message ai-message';
    messageElement.innerHTML = `
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <i class="fas fa-robot text-green-500"></i>
                </div>
            </div>
            <div class="ml-3 bg-green-100 rounded-lg py-2 px-3 max-w-[85%]">
                <p class="text-sm text-gray-800 whitespace-pre-wrap">${formatMessageText(message)}</p>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(messageElement);
    
    // おすすめ質問コンポーネントを生成して追加
    await generateAndShowSuggestedQuestions(message);
    
    // スクロールを一番下に
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// AI考え中メッセージを表示（一意のIDを返す）
function showThinkingMessage() {
    const chatMessages = document.getElementById('chat-messages');
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

// 考え中メッセージを削除
function removeThinkingMessage(thinkingId) {
    if (!thinkingId) return;
    
    const thinkingElement = document.getElementById(thinkingId);
    if (thinkingElement) {
        thinkingElement.remove();
    }
}

// チャット履歴の更新
function updateChatHistory(userMessage, aiResponse) {
    chatHistory.push({ role: 'user', content: userMessage });
    chatHistory.push({ role: 'assistant', content: aiResponse });
    
    // 履歴が長すぎる場合は古いものを削除
    if (chatHistory.length > 20) {
        chatHistory = chatHistory.slice(-20);
    }
}

// チャットのクリア
function clearChat() {
    console.log('Clearing chat history');
    chatHistory = [];
    const chatMessages = document.getElementById('chat-messages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
        // クリア完了メッセージを表示
        showAiMessage('チャット履歴をクリアしました。何か質問がありましたらどうぞ。');
        // 少し時間をおいてウェルカムメッセージを表示
        setTimeout(() => {
            showAiMessage('こんにちは！農地分析AIアシスタントです。圃場データの分析や作物の健康状態について質問してください。');
        }, 1000);
    }
}

// 現在の圃場データを取得
function getCurrentFieldData() {
    // グローバル変数currentFieldIdを使用
    if (typeof currentFieldId !== 'undefined' && currentFieldId) {
        return getFieldById(currentFieldId);
    }
    return null;
}

// 最新の分析データを取得
function getLatestAnalysisData() {
    // グローバル変数に最新の分析データが保存されていると仮定
    if (typeof window.latestAnalysisData !== 'undefined') {
        return window.latestAnalysisData;
    }
    return null;
}

// メッセージテキストの整形（Markdownライクなフォーマットをサポート）
function formatMessageText(text) {
    if (!text) return '';
    
    // HTMLエスケープ
    let formattedText = escapeHtml(text);
    
    // 見出し (##)
    formattedText = formattedText.replace(/^##\s+(.+)$/gm, '<h3 class="text-lg font-bold mt-2 mb-1">$1</h3>');
    
    // 強調 (**)
    formattedText = formattedText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // 箇条書き
    formattedText = formattedText.replace(/^[*-]\s+(.+)$/gm, '<li class="ml-4">$1</li>');
    
    // 数値（緑色表示）
    formattedText = formattedText.replace(/(\b\d+\.\d+\b)/g, '<span class="text-green-600 font-medium">$1</span>');
    
    return formattedText;
}

// HTMLエスケープ関数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// おすすめの質問を生成して表示する関数
async function generateAndShowSuggestedQuestions(aiResponse) {
    try {
        // 現在の圃場データと分析データを取得
        const fieldData = getCurrentFieldData();
        const analysisData = getLatestAnalysisData();
        
        // チャット履歴の最後の質問を取得（ユーザーの最後の質問）
        const lastUserQuestion = chatHistory.length > 0 ? 
            chatHistory.filter(msg => msg.role === 'user').pop()?.content : '';
        
        // おすすめ質問を生成
        const suggestedQuestions = await generateSuggestedQuestions(lastUserQuestion, aiResponse, fieldData, analysisData);
        
        if (suggestedQuestions && suggestedQuestions.length > 0) {
            showSuggestedQuestionsComponent(suggestedQuestions);
        }
    } catch (error) {
        console.error('おすすめ質問の生成中にエラーが発生しました:', error);
    }
}

// おすすめ質問を生成する関数
async function generateSuggestedQuestions(userQuestion, aiResponse, fieldData, analysisData) {
    try {
        // プロンプトを作成
        const prompt = createSuggestedQuestionsPrompt(userQuestion, aiResponse, fieldData, analysisData);
        
        // APIキーが設定されているか確認
        const apiKey = getGeminiApiKey();
        if (!apiKey) {
            console.warn('Gemini APIキーが設定されていません。デフォルトのおすすめ質問を返します。');
            return generateDefaultSuggestedQuestions(fieldData, analysisData);
        }
        
        // Gemini APIを使用して質問を生成
        const response = await fetchGeminiSuggestedQuestions(apiKey, prompt);
        
        return response;
    } catch (error) {
        console.error('おすすめ質問生成エラー:', error);
        return generateDefaultSuggestedQuestions(fieldData, analysisData);
    }
}

// おすすめ質問生成用のプロンプトを作成
function createSuggestedQuestionsPrompt(userQuestion, aiResponse, fieldData, analysisData) {
    let prompt = `
あなたは農業の専門家AIアシスタントです。ユーザーとの会話の流れを分析して、次に聞きたくなるであろう3つの質問を提案してください。

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

    // 分析データがある場合は追加
    if (analysisData && analysisData.stats) {
        const stats = analysisData.stats;
        prompt += `
## 最新の植生指標データ:
- NDVI（植生指標）: ${stats.ndvi ? stats.ndvi.mean : '不明'}
- NDMI（水分指標）: ${stats.ndmi ? stats.ndmi.mean : '不明'}
- NDRE（栄養指標）: ${stats.ndre ? stats.ndre.mean : '不明'}
`;
    } else {
        prompt += `\n## 植生指標データ: まだ分析されていません\n`;
    }

    prompt += `
## 回答要求:
上記の情報を基に、農家が次に知りたくなるであろう実用的で具体的な質問を3つ提案してください。
質問は以下の条件を満たしてください：
1. 各質問は30文字以内で簡潔に
2. 農業の実践に役立つ内容
3. 現在のデータや会話の流れに関連している
4. 初心者にも理解しやすい表現

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

// Gemini APIを使っておすすめ質問を取得
async function fetchGeminiSuggestedQuestions(apiKey, prompt) {
    try {
        // gemini-api.jsのgetGeminiAdvice関数を使用（チャットモード）
        const chatData = {
            type: 'suggested_questions',
            message: prompt,
            context: {
                fieldData: getCurrentFieldData(),
                analysisData: getLatestAnalysisData()
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
                console.warn('JSON解析に失敗、デフォルト質問を使用:', parseError);
            }
        }
        
        return generateDefaultSuggestedQuestions(getCurrentFieldData(), getLatestAnalysisData());
    } catch (error) {
        console.error('Gemini APIでおすすめ質問取得に失敗:', error);
        return generateDefaultSuggestedQuestions(getCurrentFieldData(), getLatestAnalysisData());
    }
}

// デフォルトのおすすめ質問を生成
function generateDefaultSuggestedQuestions(fieldData, analysisData) {
    const defaultQuestions = [];
    
    if (analysisData && analysisData.stats) {
        // 分析データがある場合の質問
        if (analysisData.stats.ndvi && analysisData.stats.ndvi.mean < 0.5) {
            defaultQuestions.push('植生を改善するにはどうすれば良いですか？');
        }
        if (analysisData.stats.ndmi && analysisData.stats.ndmi.mean < 0.2) {
            defaultQuestions.push('水分不足の対策を教えてください');
        }
        if (analysisData.stats.ndre && analysisData.stats.ndre.mean < 0.15) {
            defaultQuestions.push('どのような肥料が効果的ですか？');
        }
        
        // 足りない分をランダムで補完
        const additionalQuestions = [
            '収穫時期の見極め方を教えて',
            '病害虫の予防方法は？',
            '次の作付けの準備はいつから？'
        ];
        
        while (defaultQuestions.length < 3 && additionalQuestions.length > 0) {
            const randomIndex = Math.floor(Math.random() * additionalQuestions.length);
            defaultQuestions.push(additionalQuestions.splice(randomIndex, 1)[0]);
        }
    } else {
        // 分析データがない場合の基本的な質問
        defaultQuestions.push(
            'この圃場の状態を詳しく知りたい',
            '植生指標の見方を教えて',
            '分析結果の活用方法は？'
        );
    }
    
    return defaultQuestions.slice(0, 3);
}

// おすすめ質問コンポーネントを表示
function showSuggestedQuestionsComponent(questions) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages || !questions || questions.length === 0) return;
    
    const suggestedQuestionsElement = document.createElement('div');
    suggestedQuestionsElement.className = 'suggested-questions-container';
    suggestedQuestionsElement.innerHTML = `
        <div class="suggested-questions-header">
            <i class="fas fa-lightbulb text-yellow-500"></i>
            <span class="suggested-questions-title">次のおすすめ質問</span>
        </div>
        <div class="suggested-questions-buttons">
            ${questions.map((question, index) => `
                <button 
                    class="suggested-question-btn" 
                    onclick="handleSuggestedQuestionClick('${escapeHtml(question)}')"
                    data-question="${escapeHtml(question)}"
                >
                    ${escapeHtml(question)}
                </button>
            `).join('')}
        </div>
    `;
    
    chatMessages.appendChild(suggestedQuestionsElement);
}

// おすすめ質問ボタンクリック時の処理
function handleSuggestedQuestionClick(question) {
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
        // 質問をテキストエリアに入力
        chatInput.value = question;
        chatInput.focus();
        
        // オプション: 自動的に送信する場合
        // handleChatSubmit();
    }
}

// エクスポート
window.aiChat = {
    initialize: initializeAiChat,
    togglePanel: toggleChatPanel,
    closePanel: closePanel,
    clearChat: clearChat
};

// おすすめ質問のクリックハンドラをグローバルに公開
window.handleSuggestedQuestionClick = handleSuggestedQuestionClick; 