# Railway デプロイエラー修正ガイド

## エラー内容

"Nixpacks was unable to generate a build plan for this app"

このエラーは、Railwayがルートディレクトリを見ているため、Node.jsアプリを検出できないことが原因です。

## 解決方法

### 方法1: Railwayの設定でRoot Directoryを変更（推奨）

1. Railwayのダッシュボードでサービスを開く
2. 「Settings」タブをクリック
3. 「Root Directory」セクションを見つける
4. Root Directoryを`backend`に設定
5. 「Save」をクリック
6. サービスを再デプロイ

### 方法2: nixpacks.tomlを使用

`nixpacks.toml`ファイルを追加しました。これにより、Nixpacksが正しくビルドプランを生成できるようになります。

### 方法3: Dockerfileを使用

Root Directoryを`backend`に設定し、Dockerfileを使用する場合：

1. Railwayの設定で「Use Dockerfile」を有効化
2. Root Directoryを`backend`に設定

## 確認事項

1. ✅ `backend/package.json`が存在する
2. ✅ `backend/.nvmrc`が存在する（Node.js 18を指定）
3. ✅ `railway.json`が正しく設定されている
4. ✅ `nixpacks.toml`が追加された

## 次のステップ

1. Railwayの設定でRoot Directoryを`backend`に変更
2. 変更を保存
3. サービスを再デプロイ
4. ビルドログを確認

## 環境変数の設定

デプロイ前に、以下の環境変数を設定してください：

- `DATABASE_URL`: PostgreSQL接続文字列
- `REDIS_URL`: Redis接続文字列
- `JWT_SECRET`: 強力なランダム文字列
- `PORT`: 3001
- `FRONTEND_URL`: フロントエンドのURL
- `NODE_ENV`: production

