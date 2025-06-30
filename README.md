# AgriLens - 農地分析システム

農地の衛星画像分析とAIによる作物健康状態評価を行うWebアプリケーションです。

## 新機能: Vertex AI 対応

### Vertex AI経由でのGemini/Gemma API利用

本システムは、Google Cloud Vertex AI経由でGeminiおよびGemmaモデルを利用できるようになりました。

#### セットアップ手順

1. **Google Cloud プロジェクトの設定**
   ```bash
   # Google Cloud CLIをインストール
   curl https://sdk.cloud.google.com | bash
   
   # 認証
   gcloud auth login
   
   # プロジェクトを設定
   gcloud config set project YOUR_PROJECT_ID
   ```

2. **Vertex AI APIの有効化**
   ```bash
   gcloud services enable aiplatform.googleapis.com
   ```

3. **サービスアカウントの作成**
   ```bash
   # サービスアカウント作成
   gcloud iam service-accounts create agrilens-ai \
     --description="AgriLens AI Service Account" \
     --display-name="AgriLens AI"
   
   # 権限付与
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:agrilens-ai@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   
   # キーファイル作成
   gcloud iam service-accounts keys create ./service-account-key.json \
     --iam-account=agrilens-ai@YOUR_PROJECT_ID.iam.gserviceaccount.com
   ```

4. **環境変数の設定**
   ```bash
   # .envファイルを作成
   cp .env.example .env
   
   # 以下の変数を設定（.envファイル内で）
   # Google OAuth (Optional)
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_REDIRECT_URI=your-redirect-uri
   GOOGLE_PRIVATE_KEY_ID=your-private-key-id
   GOOGLE_CLOUD_REGION=asia-northeast1
   
   # API設定
   AI_API_PROVIDER=vertex  # または gemini-direct
   AI_MODEL=gemini-2.0-flash-thinking-exp-01-21
   
   # フォールバック用（直接API）
   GEMINI_API_KEY=your-gemini-api-key
   
   # Security
   SESSION_SECRET=your-secure-session-secret
   
   # サーバー設定
   PORT=3000
   NODE_ENV=development
   ```

5. **依存関係のインストール**
   ```bash
   npm install
   ```

#### 利用可能なモデル

**Geminiモデル:**
- `gemini-1.5-flash`: 高速応答、コスト効率重視
- `gemini-1.5-pro`: 高精度、複雑なタスク向け
- `gemini-2.0-flash-thinking-exp-01-21`: 最新の思考型モデル（実験的機能、推奨）

**Gemmaモデル:**
- `gemma-2-9b-it`: オープンソース、中規模モデル
- `gemma-2-27b-it`: オープンソース、大規模モデル

#### モデル選択

Webアプリケーション上でリアルタイムにモデルを切り替えることができます。選択したモデル設定は自動的に保存されます。

## 従来のGemini API（直接利用）

Vertex AIを使用しない場合は、従来通り直接Gemini APIを利用できます：

```bash
# .envファイルで設定
AI_API_PROVIDER=gemini-direct
GEMINI_API_KEY=your_api_key
```

## 機能

- 🛰️ 衛星画像による植生指標分析（NDVI、NDMI、NDRE）
- 🤖 AI農業アドバイザー（Gemini/Gemma対応）
- 📊 時系列データの可視化
- 📋 圃場管理とデータエクスポート
- 💬 インタラクティブなAIチャット

## 技術スタック

- **フロントエンド**: HTML5, CSS3, JavaScript, Leaflet.js
- **バックエンド**: Node.js, Express
- **AI**: Google Cloud Vertex AI (Gemini/Gemma)
- **データ**: ローカルストレージ, CSVエクスポート

## 開発・起動

```bash
# 依存関係インストール
npm install

# 開発サーバー起動
npm start

# テスト実行
npm test
```

## Cloud Runへのデプロイ

AgriLensはGoogle Cloud Runにデプロイして本番環境で運用できます。

### 前提条件

1. **Google Cloud CLIのインストール**
   ```bash
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   ```

2. **Google Cloudへの認証**
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

3. **必要なAPIの有効化**
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable earthengine.googleapis.com
   gcloud services enable aiplatform.googleapis.com
   ```

### デプロイ手順

1. **環境変数の設定**
   
   `.env`ファイルに本番環境用の設定を追加：
   ```bash
   # Google Cloud設定
   GOOGLE_PROJECT_ID=your-project-id
   GOOGLE_CLOUD_REGION=asia-northeast1
   
   # Earth Engine認証（環境変数方式推奨）
   GOOGLE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   GOOGLE_PRIVATE_KEY_ID=your-private-key-id
   
   # Vertex AI設定
   AI_API_PROVIDER=vertex
   AI_MODEL=gemini-2.0-flash-thinking-exp-01-21
   
   # 本番環境URL
   PRODUCTION_URL=https://your-service-name-xxx-an.a.run.app
   
   # セキュリティ
   SESSION_SECRET=your-secure-random-session-secret
   NODE_ENV=production
   ```

2. **デプロイスクリプトの実行**
   ```bash
   # デプロイスクリプトに実行権限を付与
   chmod +x ./shell/deploy.sh
   
   # Cloud Runにデプロイ
   ./shell/deploy.sh
   ```

3. **デプロイ完了後の確認**
   
   デプロイが成功すると、以下のような出力が表示されます：
   ```
   ✅ Deployment completed successfully!
   🌐 Service URL: https://your-service-name-xxx-an.a.run.app
   ```

### デプロイスクリプトの機能

`./shell/deploy.sh`スクリプトは以下を自動実行します：

- 環境変数の読み込み
- Google Cloudプロジェクトの設定
- 課金状態の確認
- 必要なAPIの有効化
- Cloud Runへのデプロイ
- サービスへの一般アクセス許可設定

### トラブルシューティング

**認証エラーが発生する場合：**
```bash
# サービスアカウントキーを再作成
gcloud iam service-accounts keys create ./service-account-key.json \
  --iam-account=your-service-account@your-project.iam.gserviceaccount.com

# 環境変数を再設定
```

**デプロイが失敗する場合：**
```bash
# ログを確認
gcloud run services describe agrilens --region=asia-northeast1
gcloud logs read --service=agrilens --region=asia-northeast1
```

**メモリ不足エラーの場合：**
```bash
# メモリ制限を増やしてデプロイ
gcloud run deploy agrilens \
  --source . \
  --region=asia-northeast1 \
  --memory=1Gi \
  --allow-unauthenticated
```

### 運用コマンド

```bash
# サービス状態確認
gcloud run services list --region=asia-northeast1

# ログ確認
./shell/logs.sh

# サービス更新（コード変更後）
./shell/update.sh
```

## ライセンス

MIT License + The Commons Clause
