// AI モデル選択・管理モジュール

/**
 * AIモデル選択器クラス
 */
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
        
        this.defaultModel = 'gemini-1.5-flash';
        this.currentModel = this.loadSelectedModel();
        
        this.initializeSelector();
    }
    
    /**
     * 現在選択されているモデルを読み込み
     */
    loadSelectedModel() {
        const saved = localStorage.getItem('selected_ai_model');
        return saved || this.defaultModel;
    }
    
    /**
     * モデル選択を保存
     */
    saveSelectedModel(modelId) {
        localStorage.setItem('selected_ai_model', modelId);
        this.currentModel = modelId;
        this.notifyModelChange();
    }
    
    /**
     * モデル変更を通知
     */
    notifyModelChange() {
        const event = new CustomEvent('aiModelChanged', {
            detail: { modelId: this.currentModel }
        });
        window.dispatchEvent(event);
    }
    
    /**
     * モデル選択UIを初期化
     */
    initializeSelector() {
        // DOMの準備ができるまで待つ
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.createSelector());
        } else {
            this.createSelector();
        }
    }
    
    /**
     * セレクターを作成
     */
    createSelector() {
        // 既存のセレクターがあるかチェック
        if (document.getElementById('ai-model-selector')) {
            return;
        }
        
        // セレクターHTMLを作成
        const selectorHtml = this.createSelectorHtml();
        
        // ヘッダーまたは適切な場所に追加
        const header = document.querySelector('.header') || document.querySelector('nav') || document.body;
        if (header) {
            const selectorContainer = document.createElement('div');
            selectorContainer.innerHTML = selectorHtml;
            if (selectorContainer.firstElementChild) {
                header.appendChild(selectorContainer.firstElementChild);
                this.attachEventListeners();
            }
        } else {
            console.warn('AIモデル選択器の配置場所が見つかりません');
        }
    }
    
    /**
     * セレクターHTMLを生成
     */
    createSelectorHtml() {
        const allModels = [...this.availableModels.gemini, ...this.availableModels.gemma];
        
        return `
            <div id="ai-model-selector" class="relative">
                <label for="model-select" class="block text-sm font-medium text-gray-700 mb-1">
                    AIモデル選択
                </label>
                <select id="model-select" class="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    ${allModels.map(model => `
                        <option value="${model.id}" ${model.id === this.currentModel ? 'selected' : ''}>
                            ${model.name}
                        </option>
                    `).join('')}
                </select>
                <div id="model-description" class="mt-1 text-xs text-gray-500">
                    ${this.getModelDescription(this.currentModel)}
                </div>
            </div>
        `;
    }
    
    /**
     * イベントリスナーを追加
     */
    attachEventListeners() {
        const selector = document.getElementById('model-select');
        const description = document.getElementById('model-description');
        
        if (selector) {
            selector.addEventListener('change', (e) => {
                const selectedModel = e.target.value;
                this.saveSelectedModel(selectedModel);
                
                if (description) {
                    description.textContent = this.getModelDescription(selectedModel);
                }
                
                console.log(`AIモデルが変更されました: ${selectedModel}`);
            });
        }
    }
    
    /**
     * モデルの説明を取得
     */
    getModelDescription(modelId) {
        const allModels = [...this.availableModels.gemini, ...this.availableModels.gemma];
        const model = allModels.find(m => m.id === modelId);
        return model ? model.description : '';
    }
    
    /**
     * 現在のモデルIDを取得
     */
    getCurrentModel() {
        return this.currentModel;
    }
    
    /**
     * モデルタイプを取得（gemini or gemma）
     */
    getModelType(modelId = null) {
        const id = modelId || this.currentModel;
        return id.startsWith('gemma') ? 'gemma' : 'gemini';
    }
    
    /**
     * モデルが利用可能かチェック
     */
    isModelAvailable(modelId) {
        const allModels = [...this.availableModels.gemini, ...this.availableModels.gemma];
        return allModels.some(model => model.id === modelId);
    }
}

// グローバルインスタンスを作成
window.aiModelSelector = new AiModelSelector();

// モジュールとしてエクスポート
window.AiModelSelector = AiModelSelector; 