// チャットメッセージテンプレート

const ChatTemplates = {
    // ユーザーメッセージテンプレート
    userMessage: (message) => `
        <div class="flex items-start justify-end">
            <div class="mr-3 bg-blue-100 rounded-lg py-2 px-3 max-w-[85%]">
                <p class="text-sm text-gray-800 whitespace-pre-wrap">${message}</p>
            </div>
            <div class="flex-shrink-0">
                <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <i class="fas fa-user text-blue-500"></i>
                </div>
            </div>
        </div>
    `,
    
    // AIメッセージテンプレート（ダッシュボード用）
    aiMessage: (message, isRealAI = false) => {
        const aiIcon = isRealAI ? 'fas fa-robot' : 'fas fa-cog';
        const aiColor = isRealAI ? 'text-green-500' : 'text-orange-500';
        const bgColor = isRealAI ? 'bg-green-100' : 'bg-orange-50';
        const borderColor = isRealAI ? 'border-green-200' : 'border-orange-200';
        
        return `
            <div class="flex items-start">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 rounded-full ${bgColor} flex items-center justify-center border ${borderColor}">
                        <i class="${aiIcon} ${aiColor}"></i>
                    </div>
                </div>
                <div class="ml-3 ${bgColor} rounded-lg py-2 px-3 max-w-[85%] border ${borderColor}">
                    <p class="text-sm text-gray-800 whitespace-pre-wrap">${message}</p>
                </div>
            </div>
        `;
    },
    
    // ローディングメッセージテンプレート
    loadingMessage: () => `
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                    <i class="fas fa-spinner fa-spin text-gray-500"></i>
                </div>
            </div>
            <div class="ml-3 bg-gray-50 rounded-lg py-2 px-3">
                <p class="text-sm text-gray-600">回答を生成中...</p>
            </div>
        </div>
    `,
    
    // エラーメッセージテンプレート
    errorMessage: (error) => `
        <div class="flex items-start">
            <div class="flex-shrink-0">
                <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center border border-red-200">
                    <i class="fas fa-exclamation-triangle text-red-500"></i>
                </div>
            </div>
            <div class="ml-3 bg-red-50 rounded-lg py-2 px-3 border border-red-200">
                <p class="text-sm text-red-800">${error}</p>
            </div>
        </div>
    `
};

// グローバルで利用可能にする
window.ChatTemplates = ChatTemplates;