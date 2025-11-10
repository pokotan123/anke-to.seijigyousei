# アンケート・投票システム

リアルタイム可視化対応のWebアプリケーションとしてのアンケートシステム

## プロジェクト構成

```
【政治行政】アンケートシステム/
├── backend/          # バックエンド（Node.js + Express + TypeScript）
├── frontend/         # フロントエンド（Next.js + TypeScript）
├── database/         # データベーススキーマ・マイグレーション
├── docker/          # Docker設定ファイル
├── docs/            # ドキュメント
│   ├── 要件定義書.md
│   ├── ER図.md
│   └── 機能一覧.md
└── README.md
```

## 技術スタック

### バックエンド
- Node.js 18+
- Express.js
- TypeScript
- PostgreSQL
- Redis
- Socket.io（リアルタイム通信）

### フロントエンド
- Next.js 14+
- TypeScript
- Tailwind CSS
- Recharts（グラフ表示）
- Socket.io Client（リアルタイム通信）

## セットアップ

### 前提条件
- Node.js 18以上
- PostgreSQL 14以上
- Redis 6以上
- Docker & Docker Compose（推奨）

### 環境変数設定

#### バックエンド（.env）
```env
# サーバー設定
PORT=3001
NODE_ENV=development

# データベース
DATABASE_URL=postgresql://user:password@localhost:5432/survey_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# CORS
FRONTEND_URL=http://localhost:3000
```

#### フロントエンド（.env.local）
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

## 開発手順

### 1. リポジトリのクローン
```bash
git clone <repository-url>
cd 【政治行政】アンケートシステム
```

### 2. Docker Composeで環境構築（推奨）
```bash
docker-compose up -d
```

### 3. バックエンドのセットアップ
```bash
cd backend
npm install
npm run migrate
npm run dev
```

### 4. フロントエンドのセットアップ
```bash
cd frontend
npm install
npm run dev
```

### 5. アクセス
- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:3001
- 管理画面: http://localhost:3000/admin

## 開発コマンド

### バックエンド
```bash
cd backend
npm run dev          # 開発サーバー起動
npm run build        # ビルド
npm run start        # 本番サーバー起動
npm run migrate      # データベースマイグレーション
npm run seed         # シードデータ投入（初回のみ）
npm test             # テスト実行
```

### フロントエンド
```bash
cd frontend
npm run dev          # 開発サーバー起動
npm run build        # ビルド
npm run start        # 本番サーバー起動
npm run lint         # リント
npm test             # テスト実行
```

## 動作確認

詳細な動作確認項目は [`動作確認チェックリスト.md`](./動作確認チェックリスト.md) を参照してください。

### 基本的な動作確認

1. **バックエンドのヘルスチェック**
   ```bash
   curl http://localhost:3001/health
   ```

2. **管理画面にログイン**
   - URL: http://localhost:3000/admin/login
   - ユーザー名: `admin`
   - パスワード: `admin123`

3. **サンプルアンケートで投票**
   - シードデータ実行後、表示されるURLにアクセス
   - 投票を実行

4. **分析ダッシュボードで確認**
   - リアルタイムで投票状況が更新されることを確認

## 主要機能

- ✅ アンケート・質問の作成・管理
- ✅ ユニークURLによる投票アクセス
- ✅ リアルタイム投票状況の可視化
- ✅ ダッシュボード（BIツール機能）
- ✅ 投票データのエクスポート
- ✅ 管理者認証・権限管理

## ドキュメント

- [要件定義書](./docs/要件定義書.md)
- [ER図](./docs/ER図.md)
- [機能一覧](./docs/機能一覧.md)

## ライセンス

[ライセンス情報を記載]

