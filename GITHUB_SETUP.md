# GitHubセットアップガイド

このガイドでは、プロジェクトをGitHubにアップロードし、本番環境にデプロイする手順を説明します。

## ステップ1: GitHubリポジトリの作成

1. [GitHub](https://github.com)にログイン
2. 右上の「+」→「New repository」をクリック
3. リポジトリ名を入力（例: `survey-system`）
4. 「Public」または「Private」を選択
5. 「Create repository」をクリック

## ステップ2: ローカルでGitを初期化

ターミナルで以下のコマンドを実行：

```bash
cd "/Users/yukio/Downloads/【政治行政】アンケートシステム"

# Gitリポジトリを初期化
git init

# すべてのファイルをステージング
git add .

# 初回コミット
git commit -m "Initial commit: アンケート・投票システム"

# メインブランチに設定
git branch -M main

# GitHubリポジトリをリモートとして追加（YOUR_USERNAMEとYOUR_REPO_NAMEを置き換え）
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# プッシュ
git push -u origin main
```

## ステップ3: デプロイ

### オプションA: Vercel + Railway（推奨）

#### バックエンド（Railway）

1. [Railway](https://railway.app/)にサインアップ（GitHubアカウントでログイン）
2. 「New Project」→「Deploy from GitHub repo」を選択
3. 作成したリポジトリを選択
4. 「Add Service」→「PostgreSQL」を追加
5. 「Add Service」→「Redis」を追加
6. バックエンドサービスを追加：
   - Root Directory: `backend`
   - 環境変数を設定：
     ```
     DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
     REDIS_URL=${{Redis.REDIS_URL}}
     JWT_SECRET=your-strong-secret-key-here-change-this
     PORT=3001
     FRONTEND_URL=https://your-frontend.vercel.app
     NODE_ENV=production
     ```
7. 「Deploy」をクリック

#### フロントエンド（Vercel）

1. [Vercel](https://vercel.com/)にサインアップ（GitHubアカウントでログイン）
2. 「Add New Project」をクリック
3. リポジトリを選択
4. 設定：
   - Framework Preset: Next.js
   - Root Directory: `frontend`
   - 環境変数を設定：
     ```
     NEXT_PUBLIC_API_URL=https://your-backend.railway.app
     NEXT_PUBLIC_WS_URL=wss://your-backend.railway.app
     ```
5. 「Deploy」をクリック

### オプションB: Render（無料プランあり）

#### バックエンド

1. [Render](https://render.com/)にサインアップ
2. 「New」→「Web Service」を選択
3. GitHubリポジトリを接続
4. 設定：
   - Name: `survey-backend`
   - Root Directory: `backend`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - 環境変数を設定（Railwayと同様）

#### フロントエンド

1. 「New」→「Static Site」を選択
2. 設定：
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `.next`

## ステップ4: データベースの初期化

RailwayまたはRenderのPostgreSQLに接続して、`database/init.sql`を実行：

```bash
# Railwayの場合
railway connect postgres
psql < database/init.sql

# Renderの場合
# RenderのPostgreSQLコンソールから直接実行
```

または、バックエンドのデプロイ後に以下のコマンドを実行：

```bash
# Railwayの場合
railway run npm run seed

# Renderの場合
# RenderのShellから実行
cd backend && npm run seed
```

## ステップ5: 環境変数の更新

デプロイ後、フロントエンドの環境変数を更新：

- `NEXT_PUBLIC_API_URL`: バックエンドの実際のURL
- `NEXT_PUBLIC_WS_URL`: WebSocket URL（wss://）

## トラブルシューティング

### ビルドエラー

- Node.jsのバージョンを確認（18以上が必要）
- 依存関係が正しくインストールされているか確認

### データベース接続エラー

- 環境変数`DATABASE_URL`が正しく設定されているか確認
- PostgreSQLが起動しているか確認

### CORSエラー

- `FRONTEND_URL`が正しく設定されているか確認
- バックエンドのCORS設定を確認

## セキュリティチェックリスト

- [ ] `JWT_SECRET`を強力なランダム文字列に変更
- [ ] デフォルトのadminパスワードを変更
- [ ] 環境変数がGitにコミットされていないか確認
- [ ] HTTPSが有効になっているか確認

## 次のステップ

- カスタムドメインの設定
- モニタリングの追加
- バックアップの設定
- CI/CDパイプラインの構築

