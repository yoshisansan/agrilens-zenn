#!/usr/bin/env node

// トークン使用量制限テスト用スクリプト
const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function checkTokenUsage() {
    console.log('\n=== 現在のトークン使用状況 ===');
    
    try {
        const response = await fetch(`${BASE_URL}/api/token-usage`);
        const data = await response.json();
        
        if (data.success) {
            const usage = data.data;
            console.log(`日付: ${usage.date} (${data.timezone})`);
            console.log(`タイムスタンプ: ${data.timestamp}`);
            console.log('\n📊 Gemini使用状況:');
            console.log(`  使用量: ${usage.gemini.used.toLocaleString()} / ${usage.gemini.limit.toLocaleString()} tokens (${usage.gemini.percentage}%)`);
            console.log(`  残り: ${usage.gemini.remaining.toLocaleString()} tokens`);
            console.log(`  リクエスト数: ${usage.gemini.requests}`);
            
            console.log('\n📊 Gemma使用状況:');
            console.log(`  使用量: ${usage.gemma.used.toLocaleString()} / ${usage.gemma.limit.toLocaleString()} tokens (${usage.gemma.percentage}%)`);
            console.log(`  残り: ${usage.gemma.remaining.toLocaleString()} tokens`);
            console.log(`  リクエスト数: ${usage.gemma.requests}`);
        } else {
            console.error('エラー:', data.error);
        }
    } catch (error) {
        console.error('トークン使用状況の取得に失敗:', error.message);
    }
}

async function testAIRequest(model, prompt) {
    console.log(`\n=== ${model} APIテスト ===`);
    console.log(`プロンプト: ${prompt.substring(0, 50)}...`);
    
    try {
        const response = await fetch(`${BASE_URL}/api/ai-advice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                prompt: prompt
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            console.log('✅ リクエスト成功');
            console.log(`レスポンス長: ${data.result.length} 文字`);
            console.log(`レスポンス: ${data.result.substring(0, 100)}...`);
        } else {
            console.log('❌ リクエスト失敗');
            console.log(`ステータス: ${response.status}`);
            console.log(`エラー: ${data.error || 'Unknown error'}`);
            console.log(`メッセージ: ${data.message || 'No message'}`);
        }
    } catch (error) {
        console.log('❌ リクエスト例外:', error.message);
    }
}

async function simulateHighUsage(model, requestCount = 5) {
    console.log(`\n=== ${model} 高負荷テスト (${requestCount}回リクエスト) ===`);
    
    // 長いプロンプト（多くのトークンを消費）
    const longPrompt = `
    以下の農業に関する質問に詳細に答えてください。できるだけ多くの情報を含めて、
    専門的な知識を交えながら回答してください。
    
    質問: 持続可能な農業実践について、以下の観点から詳しく説明してください：
    1. 土壌の健康管理
    2. 水資源の効率的利用
    3. 生物多様性の保護
    4. 化学肥料・農薬の削減方法
    5. 再生可能エネルギーの活用
    6. 気候変動への適応策
    7. 経済的持続可能性
    8. 社会的責任
    
    それぞれについて具体例を挙げながら、実践的なアドバイスを提供してください。
    また、これらの要素がどのように相互に関連し合っているかについても言及してください。
    `.repeat(3); // プロンプトを3回繰り返してさらに長くする
    
    for (let i = 1; i <= requestCount; i++) {
        console.log(`\nリクエスト ${i}/${requestCount}:`);
        await testAIRequest(model, longPrompt);
        
        // 使用状況を確認
        await checkTokenUsage();
        
        // 少し待機
        if (i < requestCount) {
            console.log('⏳ 2秒待機中...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

async function runTokenLimitTests() {
    console.log('🚀 AgriLens トークン使用量制限テスト開始');
    console.log(`テスト対象: ${BASE_URL}`);
    
    try {
        // 初期状況を確認
        await checkTokenUsage();
        
        // 通常のリクエストをテスト
        console.log('\n📝 通常リクエストテスト');
        await testAIRequest('gemini-1.5-flash', 'こんにちは、AgriLensについて簡潔に説明してください。');
        
        // 使用状況を再確認
        await checkTokenUsage();
        
        // Geminiモデルの高負荷テスト
        console.log('\n🔥 Gemini高負荷テスト');
        await simulateHighUsage('gemini-1.5-flash', 3);
        
        // Vertex AIが利用可能な場合、Gemmaもテスト
        if (process.env.GOOGLE_PROJECT_ID) {
            console.log('\n🔥 Gemma高負荷テスト');
            await simulateHighUsage('gemma-2-9b-it', 2);
        }
        
        // 最終状況を確認
        console.log('\n📊 最終使用状況:');
        await checkTokenUsage();
        
        console.log('\n✅ トークン制限テスト完了');
        console.log('\n📋 確認ポイント:');
        console.log('- トークン使用量が正しく記録されていること');
        console.log('- 制限に近づいた時に警告が表示されること');
        console.log('- 制限を超過した場合にリクエストが拒否されること');
        console.log('- 日本時間での日付管理が正しく動作していること');
        
    } catch (error) {
        console.error('❌ テスト実行エラー:', error.message);
    }
}

// コマンドライン引数の処理
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'status':
        checkTokenUsage();
        break;
    case 'test':
        const model = args[1] || 'gemini-1.5-flash';
        const prompt = args[2] || 'テスト用の簡単な質問です。';
        testAIRequest(model, prompt);
        break;
    case 'load':
        const loadModel = args[1] || 'gemini-1.5-flash';
        const requestCount = parseInt(args[2]) || 3;
        simulateHighUsage(loadModel, requestCount);
        break;
    default:
        runTokenLimitTests();
        break;
}

// モジュールとしてエクスポート
module.exports = {
    checkTokenUsage,
    testAIRequest,
    simulateHighUsage,
    runTokenLimitTests
}; 