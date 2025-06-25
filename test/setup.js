/**
 * Jest テストセットアップファイル
 * 各テストの前に実行される共通設定
 */

// グローバルモックの設定
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// DOM操作関連のモック
global.document = {
  getElementById: jest.fn(),
  createElement: jest.fn(),
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

global.window = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  location: { href: '' },
  alert: jest.fn(),
  confirm: jest.fn()
};

// テスト前のクリーンアップ
beforeEach(() => {
  jest.clearAllMocks();
});

// テスト後のクリーンアップ
afterEach(() => {
  jest.restoreAllMocks();
});