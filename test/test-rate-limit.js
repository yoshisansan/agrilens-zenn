#!/usr/bin/env node

// レート制限テスト用スクリプト
const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testRateLimit(endpoint, method = 'GET', body = null) {
    console.log(`\n=== ${endpoint} のレート制限テスト ===`);
    
    const promises = [];
    
    // 5回のリクエストを同時に送信（制限は3req/min）
    for (let i = 1; i <= 5; i++) {
        const promise = fetch(`${BASE_URL}${endpoint}`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : null
        }).then(async (res) => {
            const data = await res.json().catch(() => ({ error: 'JSON parse error' }));
            return {
                request: i,
                status: res.status,
                headers: {
                    'x-ratelimit-limit': res.headers.get('x-ratelimit-limit'),
                    'x-ratelimit-remaining': res.headers.get('x-ratelimit-remaining'),
                    'x-ratelimit-reset': res.headers.get('x-ratelimit-reset'),
                },
                data: data
            };
        }).catch(err => ({
            request: i,
            error: err.message
        }));
        
        promises.push(promise);
    }
    
    const results = await Promise.all(promises);
    
    let successCount = 0;
    let rateLimitedCount = 0;
    
    results.forEach(result => {
        if (result.error) {
            console.log(`リクエスト ${result.request}: エラー - ${result.error}`);
        } else {
            console.log(`リクエスト ${result.request}: ${result.status} - ${result.status === 429 ? 'レート制限' : 'SUCCESS'}`);
            if (result.status === 200 || result.status === 201) {
                successCount++;
            } else if (result.status === 429) {
                rateLimitedCount++;
            }
            
            if (result.headers['x-ratelimit-limit']) {
                console.log(`  制限: ${result.headers['x-ratelimit-limit']}, 残り: ${result.headers['x-ratelimit-remaining']}`);
            }
        }
    });
    
    console.log(`\n結果: 成功 ${successCount}件, レート制限 ${rateLimitedCount}件`);
    console.log(`期待値: 成功 3件, レート制限 2件`);
    
    return { successCount, rateLimitedCount };
}

async function runTests() {
    console.log('🚀 AgriLens API レート制限テスト開始');
    console.log(`テスト対象: ${BASE_URL}`);
    
    try {
        // AI API テスト
        await testRateLimit('/api/server-info', 'GET');
        
        // 少し待つ
        console.log('\n⏳ 1秒待機中...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 認証API テスト
        await testRateLimit('/api/auth-status', 'GET');
        
        // 少し待つ
        console.log('\n⏳ 1秒待機中...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 分析API テスト（POSTリクエスト）
        const analysisBody = {
            aoiGeoJSON: {
                type: 'Polygon',
                coordinates: [[[139.7, 35.7], [139.8, 35.7], [139.8, 35.8], [139.7, 35.8], [139.7, 35.7]]]
            }
        };
        await testRateLimit('/api/analyze', 'POST', analysisBody);
        
        console.log('\n✅ レート制限テスト完了');
        console.log('\n📝 結果の確認ポイント:');
        console.log('- 各エンドポイントで最初の3リクエストは成功（200/201ステータス）');
        console.log('- 4番目と5番目のリクエストはレート制限エラー（429ステータス）');
        console.log('- X-RateLimit-* ヘッダーが正しく設定されていること');
        
    } catch (error) {
        console.error('❌ テスト実行エラー:', error.message);
    }
}

// メイン実行
if (require.main === module) {
    runTests();
}

module.exports = { testRateLimit, runTests }; 