# AgriLens APIセキュリティ改善実行計画

## 📋 プロジェクト概要

### 目的
AgriLensのAPIセキュリティ脆弱性を解決し、production-readyなセキュリティ体制を構築する

### 現在の主要リスク
- 🔴 **Critical**: レート制限なし、認証・認可なし、入力検証不足
- 🟠 **High**: プロンプトインジェクション対策なし、ログ記録不足
- 🟡 **Medium**: server.jsの肥大化、モジュール化不足

### アーキテクチャ改善方針
`general.md`のルールに基づき、以下の原則を適用：
- **モジュラー設計**: 責務ごとにファイル分割
- **単一責任の原則**: 各モジュールは一つの責務のみ
- **エラーハンドリングの徹底**: 全ての外部依存にエラー処理
- **セキュリティファースト**: Defense in Depthアプローチ

---

## 🏗️ 新しいディレクトリ構造

---

## 📅 実行計画（3フェーズ）

### 🚨 Phase 1: 緊急セキュリティ対応（1-2日）

#### Task 1.1: プロジェクト構造準備
- [ ] **Task 1.1.1**: 新ディレクトリ構造作成
  ```bash
  mkdir -p src/{config,middleware,routes,controllers,services,utils,types}
  mkdir -p tests/{unit,integration,security}
  ```
  - 担当: 構造設計
  - 期間: 30分
  - 成果物: ディレクトリ構造

- [ ] **Task 1.1.2**: 依存関係追加
  ```bash
  npm install express-rate-limit helmet joi express-validator winston
  npm install --save-dev supertest jest-security
  ```
  - 担当: 環境整備
  - 期間: 15分
  - 成果物: package.json更新

#### Task 1.2: 設定管理モジュール作成
- [ ] **Task 1.2.1**: `src/config/index.js` 作成
  ```javascript
  // 全ての環境変数を一元管理
  // process.envの直接参照を禁止
  ```
  - 担当: 設定管理
  - 期間: 45分
  - 成果物: 環境変数管理モジュール
  - テスト: 環境変数の読み込みテスト

- [ ] **Task 1.2.2**: `src/config/security.js` 作成
  ```javascript
  // セキュリティ設定（レート制限値、タイムアウトなど）
  // 本番/開発環境の切り替え
  ```
  - 担当: セキュリティ設定
  - 期間: 30分
  - 成果物: セキュリティ設定モジュール

#### Task 1.3: セキュリティミドルウェア実装
- [ ] **Task 1.3.1**: `src/middleware/rateLimit.js` 作成
  ```javascript
  // express-rate-limitベース
  // IP別、エンドポイント別の制限
  // Redis対応（将来の拡張性）
  ```
  - 担当: レート制限
  - 期間: 1時間
  - 成果物: レート制限ミドルウェア
  - テスト: レート制限動作テスト
  - 設定値: 
    - AI API: 10req/min per IP
    - 分析API: 5req/min per IP
    - 認証API: 3req/min per IP

- [ ] **Task 1.3.2**: `src/middleware/validation.js` 作成
  ```javascript
  // Joi/express-validatorベース
  // プロンプト長さ制限（5000文字）
  // 悪意のあるパターン検出
  // GeoJSON形式検証
  ```
  - 担当: 入力検証
  - 期間: 1.5時間
  - 成果物: 入力検証ミドルウェア
  - テスト: 各種入力パターンテスト

- [ ] **Task 1.3.3**: `src/middleware/auth.js` 作成
  ```javascript
  // Basic認証実装
  // JWT対応（将来拡張）
  // セッション管理強化
  ```
  - 担当: 認証機能
  - 期間: 1時間
  - 成果物: 認証ミドルウェア
  - テスト: 認証フローテスト

- [ ] **Task 1.3.4**: `src/middleware/logging.js` 作成
  ```javascript
  // Winstonベース
  // セキュリティイベント記録
  // 構造化ログ（JSON）
  // ログレベル管理
  ```
  - 担当: ログ機能
  - 期間: 45分
  - 成果物: ログミドルウェア
  - テスト: ログ出力テスト

#### Task 1.4: ユーティリティ作成
- [ ] **Task 1.4.1**: `src/utils/validators.js` 作成
  ```javascript
  // プロンプトインジェクション検出
  // GeoJSON検証
  // データサニタイゼーション
  ```
  - 担当: バリデーション
  - 期間: 1時間
  - 成果物: バリデーション関数群
  - テスト: セキュリティパターンテスト

- [ ] **Task 1.4.2**: `src/utils/errors.js` 作成
  ```javascript
  // カスタムエラークラス
  // エラーレスポンス標準化
  // セキュリティ情報の漏洩防止
  ```
  - 担当: エラー管理
  - 期間: 30分
  - 成果物: エラーハンドリング

---

### 🔧 Phase 2: アーキテクチャリファクタリング（2-3日）

#### Task 2.1: サービスレイヤー作成
- [ ] **Task 2.1.1**: `src/services/aiService.js` 作成
  ```javascript
  // Vertex AI統合
  // プロンプト管理
  // レスポンス検証
  // フォールバック機能
  ```
  - 担当: AIサービス
  - 期間: 2時間
  - 成果物: AI統合サービス
  - テスト: AI APIモックテスト

- [ ] **Task 2.1.2**: `src/services/geeService.js` 作成
  ```javascript
  // Google Earth Engine統合
  // 分析結果キャッシュ
  // エラーハンドリング
  ```
  - 担当: GEEサービス
  - 期間: 1.5時間
  - 成果物: GEE統合サービス
  - テスト: GEE APIモックテスト

#### Task 2.2: コントローラー作成
- [ ] **Task 2.2.1**: `src/controllers/aiController.js` 作成
  ```javascript
  // AIリクエスト処理
  // レスポンス整形
  // エラーレスポンス
  ```
  - 担当: AIコントローラー
  - 期間: 1時間
  - 成果物: AIエンドポイントハンドラー

- [ ] **Task 2.2.2**: `src/controllers/analyzeController.js` 作成
  ```javascript
  // 分析リクエスト処理
  // GeoJSON検証
  // 結果フォーマット
  ```
  - 担当: 分析コントローラー
  - 期間: 1時間
  - 成果物: 分析エンドポイントハンドラー

#### Task 2.3: ルート定義
- [ ] **Task 2.3.1**: `src/routes/` 各ファイル作成
  ```javascript
  // Express Routerベース
  // ミドルウェア適用
  // バージョニング対応
  ```
  - 担当: ルート定義
  - 期間: 1時間
  - 成果物: APIルート定義

#### Task 2.4: server.js リファクタリング
- [ ] **Task 2.4.1**: 新server.js作成
  ```javascript
  // 最小限のエントリーポイント
  // モジュール統合
  // 設定読み込み
  ```
  - 担当: エントリーポイント
  - 期間: 45分
  - 成果物: リファクタリング済みserver.js

---

### 🧪 Phase 3: テスト実装（1-2日）

#### Task 3.1: 単体テスト
- [ ] **Task 3.1.1**: セキュリティミドルウェアテスト
  ```javascript
  // レート制限テスト
  // 入力検証テスト
  // 認証テスト
  ```
  - ファイル: `tests/unit/middleware.test.js`
  - 期間: 2時間
  - カバレッジ目標: 90%以上

- [ ] **Task 3.1.2**: バリデーション関数テスト
  ```javascript
  // プロンプトインジェクション検出テスト
  // GeoJSON検証テスト
  // エッジケーステスト
  ```
  - ファイル: `tests/unit/validators.test.js`
  - 期間: 1.5時間

#### Task 3.2: 統合テスト
- [ ] **Task 3.2.1**: API エンドポイントテスト
  ```javascript
  // supertest使用
  // 正常ケース・異常ケース
  // セキュリティシナリオ
  ```
  - ファイル: `tests/integration/api.test.js`
  - 期間: 2時間

#### Task 3.3: セキュリティテスト
- [ ] **Task 3.3.1**: セキュリティ攻撃シミュレーション
  ```javascript
  // レート制限回避テスト
  // プロンプトインジェクションテスト
  // 認証バイパステスト
  ```
  - ファイル: `tests/security/attacks.test.js`
  - 期間: 2時間

#### Task 3.4: パフォーマンステスト
- [ ] **Task 3.4.1**: 負荷テスト
  ```javascript
  // 同時接続テスト
  // メモリリークテスト
  // レスポンス時間測定
  ```
  - ファイル: `tests/performance/load.test.js`
  - 期間: 1時間

---

## 📊 進捗管理

### チェックリスト形式での進捗記録

#### Phase 1 完了条件
- [ ] 全セキュリティミドルウェア実装完了
- [ ] レート制限動作確認
- [ ] 入力検証100%適用
- [ ] ログ記録機能動作確認
- [ ] 基本認証実装完了

#### Phase 2 完了条件
- [ ] server.js行数50%削減達成
- [ ] 全サービスレイヤー分離完了
- [ ] コントローラー/ルート分離完了
- [ ] 設定管理一元化完了
- [ ] 既存機能100%動作確認

#### Phase 3 完了条件
- [ ] 単体テストカバレッジ85%以上
- [ ] 統合テスト全シナリオ通過
- [ ] セキュリティテスト全項目クリア
- [ ] パフォーマンス要件達成
- [ ] CI/CD統合完了

### 品質ゲート

#### セキュリティチェックポイント
1. **Authentication**: 全エンドポイントで認証確認
2. **Authorization**: 適切な権限チェック
3. **Input Validation**: 全入力の検証実装
4. **Rate Limiting**: 全エンドポイントに制限適用
5. **Logging**: セキュリティイベント100%記録
6. **Error Handling**: 情報漏洩防止確認

#### パフォーマンスベンチマーク
- レスポンス時間: 95%のリクエストが2秒以内
- 同時接続: 100ユーザー同時接続対応
- メモリ使用量: 512MB以下での動作
- CPU使用率: 通常時30%以下

### 各タスクの記録テンプレート

```markdown
#### Task X.X.X: [タスク名]
- **開始日時**: YYYY-MM-DD HH:MM
- **完了予定**: YYYY-MM-DD HH:MM
- **実際完了**: YYYY-MM-DD HH:MM
- **担当者**: [名前]
- **ステータス**: [未着手/進行中/完了/保留]
- **進捗**: [0-100%]
- **成果物**: 
  - [ ] ファイル作成
  - [ ] テスト実装
  - [ ] ドキュメント更新
- **ブロッカー**: [あれば記載]
- **メモ**: [追加情報や学びなど]
```

---

## 🎯 成功指標

### セキュリティ指標
- [ ] 脆弱性スキャン: 0件のCritical/High
- [ ] ペネトレーションテスト: 全項目パス
- [ ] セキュリティヘッダー: A+評価
- [ ] OWASP Top 10: 全項目対策済み

### コード品質指標
- [ ] テストカバレッジ: 85%以上
- [ ] ESLint: 0エラー
- [ ] 複雑度: 10以下/関数
- [ ] 重複コード: 5%以下

### パフォーマンス指標
- [ ] Lighthouse Performance: 90点以上
- [ ] API レスポンス: 95%が2秒以内
- [ ] メモリリーク: 0件
- [ ] エラー率: 0.1%以下

---

## 🚀 次のステップ（Phase 4以降）

### 高度なセキュリティ機能
- WAF（Web Application Firewall）統合
- SIEM（Security Information and Event Management）連携
- 脅威インテリジェンス統合
- 自動セキュリティスキャン

### 運用・監視強化
- ヘルスチェックエンドポイント
- メトリクス収集（Prometheus）
- アラート設定（PagerDuty等）
- ダッシュボード構築（Grafana）

### 開発プロセス改善
- TypeScript完全移行
- 自動セキュリティテスト
- コードレビューチェックリスト
- セキュリティ教育プログラム

---

## 📚 参考資料

### セキュリティガイドライン
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

### 技術文書
- [Express Rate Limiting](https://www