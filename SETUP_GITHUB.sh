#!/bin/bash

# GitHubセットアップスクリプト

echo "🚀 GitHubセットアップを開始します..."
echo ""

# カラー定義
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Gitリポジトリの確認
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Gitリポジトリが初期化されていません${NC}"
    echo "git init を実行してください"
    exit 1
fi

echo -e "${GREEN}✅ Gitリポジトリは初期化されています${NC}"
echo ""

# リモートリポジトリの確認
if git remote | grep -q "origin"; then
    echo -e "${YELLOW}リモートリポジトリ 'origin' が既に設定されています${NC}"
    git remote -v
    echo ""
    read -p "上書きしますか？ (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "キャンセルしました"
        exit 0
    fi
fi

# GitHubリポジトリURLの入力
echo -e "${YELLOW}GitHubリポジトリのURLを入力してください${NC}"
echo "例: https://github.com/username/repo-name.git"
read -p "URL: " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo -e "${RED}❌ URLが入力されていません${NC}"
    exit 1
fi

# リモートリポジトリの設定
if git remote | grep -q "origin"; then
    git remote set-url origin "$REPO_URL"
else
    git remote add origin "$REPO_URL"
fi

echo -e "${GREEN}✅ リモートリポジトリを設定しました${NC}"
echo ""

# プッシュの確認
read -p "GitHubにプッシュしますか？ (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "プッシュ中..."
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ GitHubにプッシュしました！${NC}"
        echo ""
        echo "次のステップ:"
        echo "1. Vercelでフロントエンドをデプロイ: https://vercel.com"
        echo "2. Railwayでバックエンドをデプロイ: https://railway.app"
        echo ""
        echo "詳細は GITHUB_SETUP.md を参照してください"
    else
        echo -e "${RED}❌ プッシュに失敗しました${NC}"
        echo "GitHubリポジトリが作成されているか確認してください"
    fi
else
    echo "プッシュをスキップしました"
    echo ""
    echo "手動でプッシュする場合:"
    echo "  git push -u origin main"
fi

