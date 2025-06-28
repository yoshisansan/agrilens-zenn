// 分析結果表示テンプレート

const AnalysisTemplates = {
    // 分析結果ヘッダー
    analysisHeader: () => `
        <div class="mb-4">
            <h3 class="text-lg font-semibold mb-1 text-center bg-green-100 py-2 rounded-t-lg border-b border-green-200">
                圃場の健康状態と対策
            </h3>
        </div>
    `,
    
    // 重要な知見のまとめカード
    summaryCard: (summary) => `
        <div class="mb-4 p-4 bg-green-50 rounded-lg border border-green-100">
            <div class="flex items-start">
                <div class="mr-2">
                    <span class="inline-block bg-green-100 p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
                        </svg>
                    </span>
                </div>
                <div>
                    <h4 class="font-semibold text-green-800 mb-1">重要な知見のまとめ</h4>
                    <p class="text-sm text-gray-700">${summary}</p>
                </div>
            </div>
        </div>
    `,
    
    // 詳細評価セクションヘッダー
    detailedEvaluationHeader: () => `
        <div class="mb-2">
            <h4 class="font-semibold text-gray-700" id="detailedEvaluation">詳細な評価</h4>
        </div>
    `,
    
    // NDMIカード
    ndmiCard: (ndmi) => `
        <div class="mb-3 p-4 bg-yellow-50 rounded-lg">
            <div class="flex justify-between items-center mb-2">
                <div class="flex items-center">
                    <span class="inline-block text-yellow-500 mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" />
                        </svg>
                    </span>
                    <h5 class="font-semibold text-gray-700">水分ストレス (NDMI)</h5>
                </div>
                <span class="text-yellow-600 font-medium bg-yellow-100 px-2 py-1 rounded-full text-xs">数値 ${ndmi.value?.toFixed(2) || '0.00'}</span>
            </div>
            <p class="text-sm text-gray-600">${ndmi.text}</p>
        </div>
    `,
    
    // NDREカード
    ndreCard: (ndre) => `
        <div class="mb-3 p-4 bg-gray-50 rounded-lg">
            <div class="flex justify-between items-center mb-2">
                <div class="flex items-center">
                    <span class="inline-block text-gray-500 mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1z" clip-rule="evenodd" />
                        </svg>
                    </span>
                    <h5 class="font-semibold text-gray-700">根類状態 (NDRE)</h5>
                </div>
                <span class="text-gray-600 font-medium bg-gray-200 px-2 py-1 rounded-full text-xs">数値 ${ndre.value?.toFixed(2) || '0.00'}</span>
            </div>
            <p class="text-sm text-gray-600">${ndre.text}</p>
        </div>
    `,
    
    // 具体的な対策セクション
    actionPlan: (actions) => `
        <div class="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div class="flex items-center mb-2">
                <span class="inline-block text-blue-600 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </span>
                <h4 class="font-semibold text-blue-800">具体的な対策</h4>
            </div>
            <ul class="list-none pl-8">
                ${actions.map(item => `
                    <li class="mb-2 flex items-start">
                        <span class="inline-block text-blue-600 mr-2 mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </span>
                        <span class="text-gray-700 text-sm">${item}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `,
    
    // 管理ポイントセクション
    managementPoints: (points) => `
        <div class="mb-2 p-4 bg-yellow-50 rounded-lg border border-yellow-100">
            <div class="flex items-center mb-2">
                <span class="inline-block text-yellow-600 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </span>
                <h4 class="font-semibold text-yellow-800">今後の管理ポイント</h4>
            </div>
            <ul class="list-none pl-8">
                ${points.map(item => `
                    <li class="mb-2 flex items-start">
                        <span class="inline-block text-yellow-600 mr-2 mt-1">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </span>
                        <span class="text-gray-700 text-sm">${item}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `,
    
    // タイムスタンプ
    timestamp: () => {
        const currentTime = new Date().toLocaleString('ja-JP');
        return `
            <div class="text-right text-xs text-gray-400 mt-4">
                分析生成: ${currentTime}
            </div>
        `;
    }
};

// グローバルで利用可能にする
window.AnalysisTemplates = AnalysisTemplates;