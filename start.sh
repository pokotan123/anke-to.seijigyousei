#!/bin/bash

# アンケート・投票システム 起動スクリプト

echo "🚀 アンケート・投票システムを起動します..."

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 前提条件チェック
echo -e "${YELLOW}前提条件をチェック中...${NC}"

# Node.jsチェック
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.jsがインストールされていません${NC}"
    echo "Node.js 18以上をインストールしてください: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 18以上が必要です（現在: $(node -v)）${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js: $(node -v)${NC}"

# Dockerチェック
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker: 利用可能${NC}"
    USE_DOCKER=true
else
    echo -e "${YELLOW}⚠️  Dockerが見つかりません。手動でPostgreSQLとRedisを起動してください${NC}"
    USE_DOCKER=false
fi

# データベースとRedisの起動
if [ "$USE_DOCKER" = true ]; then
    echo -e "${YELLOW}データベースとRedisを起動中...${NC}"
    docker compose up -d
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ データベースとRedisが起動しました${NC}"
        sleep 3
    else
        echo -e "${RED}❌ データベースとRedisの起動に失敗しました${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}手動でPostgreSQLとRedisを起動してください${NC}"
    read -p "PostgreSQLとRedisが起動したらEnterキーを押してください..."
fi

# バックエンドのセットアップ
echo -e "${YELLOW}バックエンドをセットアップ中...${NC}"
cd backend

if [ ! -d "node_modules" ]; then
    echo "依存関係をインストール中..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 依存関係のインストールに失敗しました${NC}"
        exit 1
    fi
fi

# 環境変数ファイルの確認
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  .envファイルが見つかりません${NC}"
    echo "環境変数を設定してください"
fi

# シードデータの投入（初回のみ）
if [ ! -f ".seed_done" ]; then
    echo "シードデータを投入中..."
    npm run seed
    if [ $? -eq 0 ]; then
        touch .seed_done
        echo -e "${GREEN}✅ シードデータを投入しました${NC}"
    else
        echo -e "${YELLOW}⚠️  シードデータの投入に失敗しました（既にデータがある可能性があります）${NC}"
    fi
fi

# バックエンドサーバー起動
echo -e "${GREEN}バックエンドサーバーを起動中...${NC}"
npm run dev &
BACKEND_PID=$!
echo "バックエンドPID: $BACKEND_PID"

# フロントエンドのセットアップ
cd ../frontend
echo -e "${YELLOW}フロントエンドをセットアップ中...${NC}"

if [ ! -d "node_modules" ]; then
    echo "依存関係をインストール中..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ 依存関係のインストールに失敗しました${NC}"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
fi

# 環境変数ファイルの確認
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  .env.localファイルが見つかりません${NC}"
    echo "環境変数を設定してください"
fi

# フロントエンドサーバー起動
echo -e "${GREEN}フロントエンドサーバーを起動中...${NC}"
npm run dev &
FRONTEND_PID=$!
echo "フロントエンドPID: $FRONTEND_PID"

# 起動待機
echo -e "${YELLOW}サーバーの起動を待機中...${NC}"
sleep 5

# 起動確認
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ システムが起動しました！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "📊 アクセスURL:"
echo "   フロントエンド: http://localhost:3000"
echo "   バックエンドAPI: http://localhost:3001"
echo "   管理画面: http://localhost:3000/admin/login"
echo ""
echo "🔑 ログイン情報:"
echo "   ユーザー名: admin"
echo "   パスワード: admin123"
echo ""
echo -e "${YELLOW}停止するには Ctrl+C を押してください${NC}"
echo ""

# シグナルハンドリング
trap "echo ''; echo 'システムを停止中...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# プロセスの監視
wait

