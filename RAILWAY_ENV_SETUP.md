# Railway 環境変数設定ガイド

## エラー内容

```
❌ Database connection error: Error: connect ECONNREFUSED ::1:5432
```

このエラーは、PostgreSQLに接続できていないことを示しています。

## 解決方法

### 1. PostgreSQLサービスを追加

Railwayのプロジェクトで：
1. 「New」→「Database」→「Add PostgreSQL」をクリック
2. PostgreSQLサービスが作成されます

### 2. 環境変数の設定

バックエンドサービスの「Variables」タブで、以下の環境変数を設定：

#### 必須環境変数

```
DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=your-strong-secret-key-change-this-in-production
PORT=3001
FRONTEND_URL=https://your-frontend.vercel.app
NODE_ENV=production
```

#### 環境変数の設定方法

1. バックエンドサービスを選択
2. 「Variables」タブをクリック
3. 「New Variable」をクリック
4. 変数名と値を入力

**重要**: `DATABASE_URL`と`REDIS_URL`は、Railwayの変数参照構文を使用：
- `${{PostgreSQL.DATABASE_URL}}` - PostgreSQLサービスの接続文字列
- `${{Redis.REDIS_URL}}` - Redisサービスの接続文字列

### 3. Redisサービスを追加

1. 「New」→「Database」→「Add Redis」をクリック
2. Redisサービスが作成されます

### 4. サービスを再デプロイ

環境変数を設定した後：
1. バックエンドサービスを選択
2. 「Deployments」タブをクリック
3. 「Redeploy」をクリック

## 確認事項

### PostgreSQLサービス

- [ ] PostgreSQLサービスが追加されている
- [ ] サービスが起動している（緑色のインジケーター）
- [ ] `DATABASE_URL`環境変数が設定されている

### Redisサービス

- [ ] Redisサービスが追加されている
- [ ] サービスが起動している（緑色のインジケーター）
- [ ] `REDIS_URL`環境変数が設定されている

### バックエンドサービス

- [ ] Root Directoryが`backend`に設定されている
- [ ] すべての環境変数が設定されている
- [ ] サービスが再デプロイされている

## トラブルシューティング

### 環境変数が正しく設定されていない

1. Railwayのダッシュボードで環境変数を確認
2. `${{ServiceName.VARIABLE_NAME}}`の形式が正しいか確認
3. サービス名が正しいか確認（大文字小文字を区別）

### PostgreSQLに接続できない

1. PostgreSQLサービスが起動しているか確認
2. `DATABASE_URL`の値が正しいか確認
3. ネットワーク設定を確認

### Redisに接続できない

1. Redisサービスが起動しているか確認
2. `REDIS_URL`の値が正しいか確認
3. ネットワーク設定を確認

## データベースの初期化

デプロイ後、データベースを初期化する必要があります：

1. Railwayのバックエンドサービスで「Shell」を開く
2. 以下のコマンドを実行：

```bash
cd backend
npm run seed
```

または、PostgreSQLサービスに直接接続して`database/init.sql`を実行：

1. PostgreSQLサービスの「Data」タブを開く
2. 「Query」をクリック
3. `database/init.sql`の内容を貼り付けて実行

