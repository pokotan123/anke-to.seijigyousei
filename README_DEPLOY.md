# 🚀 デプロイクイックスタート

## GitHubへのアップロード

```bash
# 1. Gitリポジトリを初期化
git init

# 2. ファイルを追加
git add .

# 3. コミット
git commit -m "Initial commit"

# 4. GitHubでリポジトリを作成後、リモートを追加
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 5. プッシュ
git branch -M main
git push -u origin main
```

## デプロイ方法

### 🎯 推奨: Vercel + Railway

**フロントエンド（Vercel）**
- 無料プランあり
- Next.jsに最適化
- 自動デプロイ

**バックエンド（Railway）**
- 無料プランあり（$5クレジット/月）
- PostgreSQLとRedisを簡単に追加
- 自動デプロイ

### 📋 デプロイ手順

詳細は [GITHUB_SETUP.md](./GITHUB_SETUP.md) を参照してください。

### 🔧 必要な環境変数

**バックエンド:**
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `FRONTEND_URL`

**フロントエンド:**
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`

## 📚 詳細ドキュメント

- [GITHUB_SETUP.md](./GITHUB_SETUP.md) - GitHubセットアップ詳細
- [DEPLOY.md](./DEPLOY.md) - デプロイ方法の詳細
- [開発ガイド.md](./開発ガイド.md) - 開発環境のセットアップ

