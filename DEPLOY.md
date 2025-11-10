# デプロイガイド

このアンケートシステムを本番環境にデプロイする方法を説明します。

## デプロイ方法の選択

### 推奨: Vercel + Railway/Render

- **フロントエンド**: Vercel（Next.jsに最適化）
- **バックエンド**: Railway または Render（無料プランあり）
- **データベース**: Railway/Render の PostgreSQL
- **Redis**: Railway/Render の Redis

### その他の選択肢

- **Vercel + Supabase**: SupabaseでPostgreSQLとRedisを提供
- **Docker Compose**: 単一サーバーに全てデプロイ（VPS、AWS EC2など）

## デプロイ手順（Vercel + Railway）

### 1. GitHubにプッシュ

```bash
# Gitリポジトリの初期化
git init
git add .
git commit -m "Initial commit"

# GitHubでリポジトリを作成後
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 2. Railwayでバックエンドをデプロイ

1. [Railway](https://railway.app/)にサインアップ
2. "New Project" → "Deploy from GitHub repo" を選択
3. リポジトリを選択
4. Root Directory を `backend` に設定
5. 環境変数を設定：
   ```
   DATABASE_URL=postgresql://user:password@host:port/dbname
   REDIS_URL=redis://host:port
   JWT_SECRET=your-secret-key-here
   PORT=3001
   FRONTEND_URL=https://your-frontend.vercel.app
   NODE_ENV=production
   ```
6. PostgreSQLとRedisを追加（Add Service）

### 3. Vercelでフロントエンドをデプロイ

1. [Vercel](https://vercel.com/)にサインアップ
2. "New Project" → GitHubリポジトリを選択
3. Root Directory を `frontend` に設定
4. 環境変数を設定：
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.railway.app
   NEXT_PUBLIC_WS_URL=wss://your-backend.railway.app
   ```
5. Deploy

### 4. データベースの初期化

RailwayのPostgreSQLに接続して、`database/init.sql`を実行：

```bash
# RailwayのPostgreSQL接続情報を使用
psql $DATABASE_URL -f database/init.sql
```

または、RailwayのPostgreSQLコンソールから直接実行。

### 5. シードデータの投入

```bash
# Railwayのバックエンドに接続して実行
cd backend
npm run seed
```

## 環境変数の設定

### バックエンド（Railway）

- `DATABASE_URL`: PostgreSQL接続文字列
- `REDIS_URL`: Redis接続文字列
- `JWT_SECRET`: ランダムな文字列（本番環境用）
- `PORT`: 3001
- `FRONTEND_URL`: VercelのURL
- `NODE_ENV`: production

### フロントエンド（Vercel）

- `NEXT_PUBLIC_API_URL`: RailwayのバックエンドURL
- `NEXT_PUBLIC_WS_URL`: WebSocket URL（wss://）

## セキュリティチェックリスト

- [ ] JWT_SECRETを強力なランダム文字列に変更
- [ ] デフォルトのadminパスワードを変更
- [ ] CORS設定を本番環境のURLに限定
- [ ] レート制限を適切に設定
- [ ] HTTPSを有効化（VercelとRailwayは自動）

## トラブルシューティング

### データベース接続エラー

- RailwayのPostgreSQLの接続情報を確認
- `DATABASE_URL`が正しく設定されているか確認

### CORSエラー

- `FRONTEND_URL`が正しく設定されているか確認
- バックエンドのCORS設定を確認

### WebSocket接続エラー

- `NEXT_PUBLIC_WS_URL`が`wss://`（HTTPS）になっているか確認
- RailwayのWebSocketサポートを確認

## 参考リンク

- [Railway Documentation](https://docs.railway.app/)
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

