# Railway デプロイ設定ガイド

## エラー修正内容

`npm: command not found` エラーを修正するため、以下の変更を行いました：

1. **`.nvmrc`ファイルを追加**: Node.js 18を指定
2. **`package.json`に`engines`フィールドを追加**: Node.jsとnpmのバージョンを明示
3. **`Dockerfile`を追加**: 代替デプロイ方法として
4. **`railway.json`を更新**: ビルドコマンドを簡素化

## Railwayでの設定確認

### 1. Root Directoryの設定

Railwayのサービス設定で、**Root Directory**が`backend`に設定されていることを確認してください。

### 2. 環境変数の設定

以下の環境変数を設定してください：

```
DATABASE_URL=${{PostgreSQL.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=your-strong-secret-key-here
PORT=3001
FRONTEND_URL=https://your-frontend.vercel.app
NODE_ENV=production
```

### 3. ビルドコマンド

Root Directoryが`backend`に設定されている場合、Railwayは自動的に以下を実行します：
- `npm install`
- `npm run build`（package.jsonに定義されている場合）

### 4. スタートコマンド

`railway.json`で指定：
```
cd backend && npm start
```

または、Root Directoryが`backend`の場合：
```
npm start
```

## トラブルシューティング

### npmが見つからないエラー

1. Root Directoryが正しく設定されているか確認
2. `.nvmrc`ファイルが`backend`ディレクトリに存在するか確認
3. Railwayのサービスを再デプロイ

### ビルドエラー

1. Node.jsのバージョンが18以上であることを確認
2. `package.json`の`engines`フィールドを確認
3. ビルドログを確認

### データベース接続エラー

1. PostgreSQLサービスが追加されているか確認
2. `DATABASE_URL`環境変数が正しく設定されているか確認

## デプロイ手順

1. Railwayでサービスを作成
2. Root Directoryを`backend`に設定
3. PostgreSQLとRedisサービスを追加
4. 環境変数を設定
5. デプロイ

変更をプッシュすると、自動的に再デプロイが開始されます。

