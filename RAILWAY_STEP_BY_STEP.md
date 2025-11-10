# Railway 環境変数設定 ステップバイステップガイド

## 現在のエラー

```
Error: connect ECONNREFUSED ::1:5432
```

これは、`DATABASE_URL`が設定されていないか、正しく読み込まれていないことを示しています。

## 解決手順（詳細）

### ステップ1: Railwayプロジェクトを開く

1. [Railway](https://railway.app/)にログイン
2. プロジェクト `anke-to.seijigyousei` を開く

### ステップ2: PostgreSQLサービスを確認・追加

1. プロジェクトページで、PostgreSQLサービスが存在するか確認
2. **存在しない場合**:
   - 「New」ボタンをクリック
   - 「Database」を選択
   - 「Add PostgreSQL」をクリック
   - サービスが作成されるまで待つ（数秒）

3. **PostgreSQLサービスの名前を確認**
   - サービス名をメモ（例: `PostgreSQL`、`postgres`、`Postgres`など）
   - この名前は後で使用します

### ステップ3: Redisサービスを確認・追加

1. Redisサービスが存在するか確認
2. **存在しない場合**:
   - 「New」→「Database」→「Add Redis」をクリック

### ステップ4: バックエンドサービスの環境変数を設定

1. **バックエンドサービス（Node.jsサービス）をクリック**
   - 通常、サービス名は `backend` やプロジェクト名になっています

2. **「Variables」タブをクリック**

3. **環境変数を追加**

   **変数1: DATABASE_URL**
   - 「New Variable」をクリック
   - **Name**: `DATABASE_URL`
   - **Value**: `${{PostgreSQL.DATABASE_URL}}`
   - **重要**: `PostgreSQL`の部分を、ステップ2で確認した実際のサービス名に置き換える
   - 「Add」をクリック

   **変数2: REDIS_URL**
   - 「New Variable」をクリック
   - **Name**: `REDIS_URL`
   - **Value**: `${{Redis.REDIS_URL}}`
   - 「Add」をクリック

   **変数3: JWT_SECRET**
   - 「New Variable」をクリック
   - **Name**: `JWT_SECRET`
   - **Value**: ランダムな文字列（例: `my-super-secret-jwt-key-12345`）
   - 「Add」をクリック

   **変数4: PORT**
   - 「New Variable」をクリック
   - **Name**: `PORT`
   - **Value**: `3001`
   - 「Add」をクリック

   **変数5: FRONTEND_URL**
   - 「New Variable」をクリック
   - **Name**: `FRONTEND_URL`
   - **Value**: VercelのURL（例: `https://your-app.vercel.app`）
   - 「Add」をクリック

   **変数6: NODE_ENV**
   - 「New Variable」をクリック
   - **Name**: `NODE_ENV`
   - **Value**: `production`
   - 「Add」をクリック

### ステップ5: 環境変数の確認

「Variables」タブで、以下の環境変数がすべて表示されているか確認：

- ✅ `DATABASE_URL` = `${{PostgreSQL.DATABASE_URL}}`（または実際のサービス名）
- ✅ `REDIS_URL` = `${{Redis.REDIS_URL}}`
- ✅ `JWT_SECRET` = （設定した値）
- ✅ `PORT` = `3001`
- ✅ `FRONTEND_URL` = （VercelのURL）
- ✅ `NODE_ENV` = `production`

### ステップ6: サービスを再デプロイ

1. 「Deployments」タブをクリック
2. 最新のデプロイメントの右側にある「...」メニューをクリック
3. 「Redeploy」を選択
4. デプロイが完了するまで待つ（1-2分）

### ステップ7: ログを確認

1. 「Deployments」タブで、最新のデプロイメントをクリック
2. 「View Logs」をクリック
3. 以下のメッセージが表示されるか確認：

```
🔍 Environment check:
  DATABASE_URL: ✅ Set (postgresql://...)
  REDIS_URL: ✅ Set
  ...
✅ Database connected
```

## トラブルシューティング

### エラー: "DATABASE_URL: ❌ Not set"

**原因**: 環境変数が設定されていない、またはサービス名が間違っている

**解決策**:
1. 「Variables」タブで`DATABASE_URL`が存在するか確認
2. 値が`${{PostgreSQL.DATABASE_URL}}`の形式か確認
3. `PostgreSQL`の部分が実際のサービス名と一致しているか確認
4. サービス名は大文字小文字を区別します

### エラー: "connect ECONNREFUSED"

**原因**: 環境変数は設定されているが、接続文字列が正しくない

**解決策**:
1. PostgreSQLサービスの「Variables」タブを開く
2. `DATABASE_URL`の値をコピー
3. バックエンドサービスの「Variables」タブで、`DATABASE_URL`の値を直接貼り付け（`${{...}}`の形式ではなく）

### サービス名がわからない場合

1. Railwayのプロジェクトページで、各サービスの名前を確認
2. サービス名は、サービスカードの上部に表示されています
3. 正確にコピーして使用してください

## 確認チェックリスト

- [ ] PostgreSQLサービスが存在する
- [ ] Redisサービスが存在する
- [ ] バックエンドサービスの「Variables」タブで、すべての環境変数が設定されている
- [ ] `DATABASE_URL`の値が`${{ServiceName.DATABASE_URL}}`の形式になっている
- [ ] サービス名が実際のサービス名と一致している
- [ ] サービスを再デプロイした
- [ ] ログで`DATABASE_URL: ✅ Set`と表示されている

