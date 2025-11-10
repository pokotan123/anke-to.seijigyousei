# Railway データベース接続エラー クイック修正

## 問題

`DATABASE_URL`が設定されていない、または正しく参照されていません。

## 解決方法

### 方法1: Railwayの変数参照を使用（推奨）

1. **PostgreSQLサービスの確認**
   - Railwayのプロジェクトで、PostgreSQLサービスが存在するか確認
   - サービス名を確認（例: `PostgreSQL`、`postgres`など）

2. **環境変数の設定**
   - バックエンドサービスの「Variables」タブを開く
   - 以下の環境変数を追加：

   ```
   DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
   ```

   **重要**: `PostgreSQL`の部分は、実際のサービス名に置き換えてください。

3. **サービス名の確認方法**
   - Railwayのプロジェクトページで、PostgreSQLサービスの名前を確認
   - サービス名は大文字小文字を区別します

### 方法2: 直接接続文字列を設定

PostgreSQLサービスの「Variables」タブで、`DATABASE_URL`の値をコピーして、バックエンドサービスの環境変数に直接設定：

1. PostgreSQLサービスの「Variables」タブを開く
2. `DATABASE_URL`の値をコピー（例: `postgresql://postgres:password@host:port/railway`）
3. バックエンドサービスの「Variables」タブで、`DATABASE_URL`を追加
4. コピーした値を貼り付け

### 方法3: 手動で接続文字列を構築

PostgreSQLサービスの「Variables」タブから以下の情報を取得：
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`

これらを使って接続文字列を構築：
```
postgresql://PGUSER:PGPASSWORD@PGHOST:PGPORT/PGDATABASE
```

## 確認手順

1. **PostgreSQLサービスが存在するか確認**
   - Railwayのプロジェクトページで、PostgreSQLサービスが表示されているか
   - サービスが起動しているか（緑色のインジケーター）

2. **環境変数が設定されているか確認**
   - バックエンドサービスの「Variables」タブで、`DATABASE_URL`が存在するか
   - 値が正しく設定されているか

3. **サービスを再デプロイ**
   - 環境変数を設定した後、必ず再デプロイしてください

## よくある間違い

1. **サービス名の不一致**
   - `${{PostgreSQL.DATABASE_URL}}`の`PostgreSQL`が実際のサービス名と一致していない
   - 解決策: 実際のサービス名を確認して使用

2. **環境変数が設定されていない**
   - PostgreSQLサービスを追加したが、環境変数を設定していない
   - 解決策: バックエンドサービスの環境変数で参照を設定

3. **再デプロイしていない**
   - 環境変数を設定したが、再デプロイしていない
   - 解決策: サービスを再デプロイ

## 次のステップ

環境変数を設定した後：
1. サービスを再デプロイ
2. ログを確認して、`DATABASE_URL: ✅ Set`と表示されるか確認
3. データベース接続が成功するか確認

