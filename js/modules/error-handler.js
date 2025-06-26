// エラーハンドリング標準化モジュール

// エラータイプ定義
const ErrorTypes = {
    NETWORK: 'NETWORK_ERROR',
    API: 'API_ERROR',
    VALIDATION: 'VALIDATION_ERROR',
    PERMISSION: 'PERMISSION_ERROR',
    TIMEOUT: 'TIMEOUT_ERROR',
    UNKNOWN: 'UNKNOWN_ERROR'
};

// カスタムエラークラス
class AppError extends Error {
    constructor(message, type = ErrorTypes.UNKNOWN, details = {}) {
        super(message);
        this.name = 'AppError';
        this.type = type;
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
    
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            type: this.type,
            details: this.details,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }
}

// エラーハンドラーモジュール
moduleManager.register('errorHandler', ['logger', 'eventBus'], ({ logger, eventBus }) => {
    const errorHistory = [];
    const maxHistorySize = 100;
    
    // エラー記録
    function logError(error, context = {}) {
        const errorRecord = {
            error: error instanceof AppError ? error.toJSON() : {
                name: error.name || 'Error',
                message: error.message || 'Unknown error',
                type: ErrorTypes.UNKNOWN,
                stack: error.stack,
                timestamp: new Date().toISOString()
            },
            context,
            id: generateErrorId()
        };
        
        // 履歴に追加
        errorHistory.unshift(errorRecord);
        if (errorHistory.length > maxHistorySize) {
            errorHistory.pop();
        }
        
        // ログ出力
        logger.error(`${errorRecord.error.type}: ${errorRecord.error.message}`, errorRecord);
        
        // イベント発火
        eventBus.emit('error', errorRecord);
        
        return errorRecord.id;
    }
    
    // ユーザー向けエラーメッセージ取得
    function getUserMessage(error) {
        if (error instanceof AppError) {
            switch (error.type) {
                case ErrorTypes.NETWORK:
                    return 'ネットワーク接続に問題があります。インターネット接続を確認してください。';
                case ErrorTypes.API:
                    return 'サーバーとの通信でエラーが発生しました。しばらく後に再試行してください。';
                case ErrorTypes.VALIDATION:
                    return error.message; // バリデーションエラーはそのまま表示
                case ErrorTypes.PERMISSION:
                    return '操作する権限がありません。';
                case ErrorTypes.TIMEOUT:
                    return '処理がタイムアウトしました。しばらく後に再試行してください。';
                default:
                    return '予期しないエラーが発生しました。';
            }
        }
        return '予期しないエラーが発生しました。';
    }
    
    // エラーID生成
    function generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // APIエラーハンドラー
    function handleApiError(response, context = {}) {
        let errorType = ErrorTypes.API;
        let message = 'APIエラーが発生しました';
        
        if (response.status === 401) {
            errorType = ErrorTypes.PERMISSION;
            message = '認証が必要です';
        } else if (response.status === 403) {
            errorType = ErrorTypes.PERMISSION;
            message = 'アクセス権限がありません';
        } else if (response.status === 404) {
            message = 'リソースが見つかりません';
        } else if (response.status >= 500) {
            message = 'サーバーエラーが発生しました';
        }
        
        const error = new AppError(message, errorType, {
            status: response.status,
            statusText: response.statusText,
            url: response.url
        });
        
        return logError(error, context);
    }
    
    // ネットワークエラーハンドラー
    function handleNetworkError(error, context = {}) {
        const appError = new AppError(
            'ネットワークエラーが発生しました',
            ErrorTypes.NETWORK,
            { originalError: error.message }
        );
        
        return logError(appError, context);
    }
    
    // タイムアウトエラーハンドラー
    function handleTimeoutError(context = {}) {
        const error = new AppError(
            'リクエストがタイムアウトしました',
            ErrorTypes.TIMEOUT,
            context
        );
        
        return logError(error, context);
    }
    
    // バリデーションエラーハンドラー
    function handleValidationError(message, field = null, context = {}) {
        const error = new AppError(
            message,
            ErrorTypes.VALIDATION,
            { field, ...context }
        );
        
        return logError(error, context);
    }
    
    // Promise用エラーラッパー
    function wrapPromise(promise, context = {}) {
        return promise.catch(error => {
            logError(error, context);
            throw error;
        });
    }
    
    // 関数用エラーラッパー
    function wrapFunction(fn, context = {}) {
        return function(...args) {
            try {
                const result = fn.apply(this, args);
                if (result && typeof result.catch === 'function') {
                    return wrapPromise(result, context);
                }
                return result;
            } catch (error) {
                logError(error, context);
                throw error;
            }
        };
    }
    
    return {
        ErrorTypes,
        AppError,
        logError,
        getUserMessage,
        handleApiError,
        handleNetworkError,
        handleTimeoutError,
        handleValidationError,
        wrapPromise,
        wrapFunction,
        getErrorHistory: () => [...errorHistory]
    };
});

// グローバルエラーハンドリング設定
window.addEventListener('error', (event) => {
    const errorHandler = moduleManager.get('errorHandler');
    errorHandler.logError(event.error, {
        type: 'global',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
    });
});

window.addEventListener('unhandledrejection', (event) => {
    const errorHandler = moduleManager.get('errorHandler');
    errorHandler.logError(event.reason, {
        type: 'unhandled_promise_rejection'
    });
});