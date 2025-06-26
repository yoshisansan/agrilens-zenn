// モジュール管理システム
class ModuleManager {
    constructor() {
        this.modules = new Map();
        this.dependencies = new Map();
        this.initialized = new Set();
    }
    
    // モジュール登録
    register(name, moduleFactory, dependencies = []) {
        this.modules.set(name, {
            factory: moduleFactory,
            dependencies: dependencies,
            instance: null
        });
        this.dependencies.set(name, dependencies);
    }
    
    // モジュール取得（遅延初期化）
    get(name) {
        if (this.initialized.has(name)) {
            return this.modules.get(name)?.instance;
        }
        
        return this.initialize(name);
    }
    
    // モジュール初期化
    initialize(name) {
        if (this.initialized.has(name)) {
            return this.modules.get(name)?.instance;
        }
        
        const module = this.modules.get(name);
        if (!module) {
            throw new Error(`Module '${name}' not found`);
        }
        
        // 依存関係を先に初期化
        const deps = {};
        for (const depName of module.dependencies) {
            deps[depName] = this.initialize(depName);
        }
        
        // モジュールインスタンス作成
        module.instance = module.factory(deps);
        this.initialized.add(name);
        
        return module.instance;
    }
    
    // 全モジュール初期化
    initializeAll() {
        for (const [name] of this.modules) {
            this.initialize(name);
        }
    }
}

// グローバルモジュールマネージャー
const moduleManager = new ModuleManager();

// 設定モジュール
moduleManager.register('config', () => {
    return window.CONFIG || {};
});

// イベントバスモジュール
moduleManager.register('eventBus', () => {
    const listeners = new Map();
    
    return {
        on(event, callback) {
            if (!listeners.has(event)) {
                listeners.set(event, []);
            }
            listeners.get(event).push(callback);
        },
        
        off(event, callback) {
            if (!listeners.has(event)) return;
            const callbacks = listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        },
        
        emit(event, data) {
            if (!listeners.has(event)) return;
            listeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for '${event}':`, error);
                }
            });
        }
    };
});

// ログモジュール
moduleManager.register('logger', () => {
    const logLevel = {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3
    };
    
    const currentLevel = logLevel.INFO;
    
    return {
        error: (message, ...args) => {
            if (currentLevel >= logLevel.ERROR) {
                console.error(`[ERROR] ${message}`, ...args);
            }
        },
        
        warn: (message, ...args) => {
            if (currentLevel >= logLevel.WARN) {
                console.warn(`[WARN] ${message}`, ...args);
            }
        },
        
        info: (message, ...args) => {
            if (currentLevel >= logLevel.INFO) {
                console.info(`[INFO] ${message}`, ...args);
            }
        },
        
        debug: (message, ...args) => {
            if (currentLevel >= logLevel.DEBUG) {
                console.log(`[DEBUG] ${message}`, ...args);
            }
        }
    };
});

// ストレージモジュール
moduleManager.register('storage', () => {
    return {
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error('Storage get error:', error);
                return defaultValue;
            }
        },
        
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('Storage set error:', error);
                return false;
            }
        },
        
        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('Storage remove error:', error);
                return false;
            }
        },
        
        clear() {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.error('Storage clear error:', error);
                return false;
            }
        }
    };
});

// エクスポート
window.ModuleManager = moduleManager;