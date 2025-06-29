const moment = require('moment-timezone');
const fs = require('fs-extra');
const path = require('path');

/**
 * トークン使用量制限管理クラス
 * 日本時間ベースで1日あたりのトークン使用量を追跡・制限
 */
class TokenLimiter {
    constructor() {
        this.JAPAN_TIMEZONE = 'Asia/Tokyo';
        this.DATA_FILE = path.join(__dirname, '../../logs/token-usage.json');
        this.DAILY_LIMITS = {
            'gemini': 2000000,  // 2M tokens
            'gemma': 2000000    // 2M tokens
        };
        
        // 使用量データを初期化
        this.usage = {
            date: null,
            gemini: { tokens: 0, requests: 0 },
            gemma: { tokens: 0, requests: 0 }
        };
        
        // 起動時にデータを読み込み
        this.loadUsageData();
        
        // 日本時間0:00のチェック用タイマーを設定
        this.scheduleReset();
    }
    
    /**
     * 現在の日本時間の日付文字列を取得
     * @returns {string} YYYY-MM-DD形式の日付
     */
    getCurrentJapanDate() {
        return moment().tz(this.JAPAN_TIMEZONE).format('YYYY-MM-DD');
    }
    
    /**
     * 使用量データをファイルから読み込み
     */
    async loadUsageData() {
        try {
            // ログディレクトリを作成
            await fs.ensureDir(path.dirname(this.DATA_FILE));
            
            if (await fs.pathExists(this.DATA_FILE)) {
                const data = await fs.readJson(this.DATA_FILE);
                this.usage = data;
                console.log('トークン使用量データを読み込みました:', this.usage);
            } else {
                console.log('新しいトークン使用量データファイルを作成します');
                this.resetUsage();
            }
            
            // 日付が変わっていたらリセット
            const currentDate = this.getCurrentJapanDate();
            if (this.usage.date !== currentDate) {
                console.log(`日付変更を検出 (${this.usage.date} -> ${currentDate}): 使用量をリセットします`);
                this.resetUsage();
            }
        } catch (error) {
            console.error('トークン使用量データの読み込みエラー:', error);
            this.resetUsage();
        }
    }
    
    /**
     * 使用量データをファイルに保存
     */
    async saveUsageData() {
        try {
            await fs.writeJson(this.DATA_FILE, this.usage, { spaces: 2 });
        } catch (error) {
            console.error('トークン使用量データの保存エラー:', error);
        }
    }
    
    /**
     * 使用量をリセット
     */
    resetUsage() {
        const currentDate = this.getCurrentJapanDate();
        this.usage = {
            date: currentDate,
            gemini: { tokens: 0, requests: 0 },
            gemma: { tokens: 0, requests: 0 }
        };
        this.saveUsageData();
        console.log(`トークン使用量をリセットしました (日付: ${currentDate})`);
    }
    
    /**
     * 指定されたモデルでリクエストが制限内かチェック
     * @param {string} modelName - モデル名 (gemini-* or gemma-*)
     * @param {number} estimatedTokens - 推定トークン数（リクエスト前チェック用）
     * @returns {Object} { allowed: boolean, remaining: number, message: string }
     */
    checkLimit(modelName, estimatedTokens = 1000) {
        const modelType = this.getModelType(modelName);
        const currentUsage = this.usage[modelType];
        const limit = this.DAILY_LIMITS[modelType];
        const remaining = limit - currentUsage.tokens;
        
        if (currentUsage.tokens + estimatedTokens > limit) {
            return {
                allowed: false,
                remaining: remaining,
                message: `${modelType.toUpperCase()}の1日あたりのトークン使用量上限（${limit.toLocaleString()}）に達しています。残り: ${remaining.toLocaleString()} tokens`
            };
        }
        
        return {
            allowed: true,
            remaining: remaining,
            message: `OK - 残り使用可能トークン: ${remaining.toLocaleString()}`
        };
    }
    
    /**
     * トークン使用量を記録
     * @param {string} modelName - モデル名
     * @param {number} inputTokens - 入力トークン数
     * @param {number} outputTokens - 出力トークン数
     */
    async recordUsage(modelName, inputTokens = 0, outputTokens = 0) {
        const modelType = this.getModelType(modelName);
        const totalTokens = inputTokens + outputTokens;
        
        this.usage[modelType].tokens += totalTokens;
        this.usage[modelType].requests += 1;
        
        console.log(`トークン使用量記録: ${modelType} - 入力: ${inputTokens}, 出力: ${outputTokens}, 合計: ${totalTokens}`);
        console.log(`累計使用量: ${modelType} - ${this.usage[modelType].tokens.toLocaleString()} tokens (${this.usage[modelType].requests} requests)`);
        
        await this.saveUsageData();
    }
    
    /**
     * モデル名からモデルタイプを取得
     * @param {string} modelName - モデル名
     * @returns {string} 'gemini' or 'gemma'
     */
    getModelType(modelName) {
        if (modelName.toLowerCase().startsWith('gemma')) {
            return 'gemma';
        }
        return 'gemini';
    }
    
    /**
     * 現在の使用状況を取得
     * @returns {Object} 使用状況の詳細
     */
    getUsageStatus() {
        const currentDate = this.getCurrentJapanDate();
        
        return {
            date: currentDate,
            gemini: {
                used: this.usage.gemini.tokens,
                limit: this.DAILY_LIMITS.gemini,
                remaining: this.DAILY_LIMITS.gemini - this.usage.gemini.tokens,
                requests: this.usage.gemini.requests,
                percentage: Math.round((this.usage.gemini.tokens / this.DAILY_LIMITS.gemini) * 100)
            },
            gemma: {
                used: this.usage.gemma.tokens,
                limit: this.DAILY_LIMITS.gemma,
                remaining: this.DAILY_LIMITS.gemma - this.usage.gemma.tokens,
                requests: this.usage.gemma.requests,
                percentage: Math.round((this.usage.gemma.tokens / this.DAILY_LIMITS.gemma) * 100)
            }
        };
    }
    
    /**
     * 日本時間0:00のリセットタイマーを設定
     */
    scheduleReset() {
        const now = moment().tz(this.JAPAN_TIMEZONE);
        const tomorrow = now.clone().add(1, 'day').startOf('day');
        const msUntilMidnight = tomorrow.diff(now);
        
        console.log(`次回リセット予定: ${tomorrow.format('YYYY-MM-DD HH:mm:ss')} JST (${Math.round(msUntilMidnight / 1000 / 60)} 分後)`);
        
        setTimeout(() => {
            console.log('日本時間0:00 - トークン使用量をリセットします');
            this.resetUsage();
            
            // 24時間後の次回リセットをスケジュール
            this.scheduleReset();
        }, msUntilMidnight);
    }
    
    /**
     * Vertex AIのusageオブジェクトからトークン数を抽出
     * @param {Object} usage - Vertex AIのusageオブジェクト
     * @returns {Object} { inputTokens, outputTokens }
     */
    extractTokensFromUsage(usage) {
        if (!usage) {
            console.warn('使用量情報が提供されていません');
            return { inputTokens: 0, outputTokens: 0 };
        }
        
        const inputTokens = usage.promptTokenCount || 0;
        const outputTokens = usage.candidatesTokenCount || 0;
        
        return { inputTokens, outputTokens };
    }
}

module.exports = TokenLimiter; 