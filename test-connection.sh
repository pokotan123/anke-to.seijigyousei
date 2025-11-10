#!/bin/bash

# システム接続テストスクリプト

echo "🔍 システム接続テストを開始します..."
echo ""

# カラー定義
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# バックエンドのヘルスチェック
echo -e "${YELLOW}バックエンドのヘルスチェック...${NC}"
BACKEND_RESPONSE=$(curl -s http://localhost:3001/health 2>/dev/null)

if [ $? -eq 0 ] && echo "$BACKEND_RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✅ バックエンド: 正常${NC}"
    echo "   レスポンス: $BACKEND_RESPONSE"
else
    echo -e "${RED}❌ バックエンド: 接続失敗${NC}"
    echo "   バックエンドが起動しているか確認してください"
fi

echo ""

# フロントエンドの確認
echo -e "${YELLOW}フロントエンドの確認...${NC}"
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)

if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ フロントエンド: 正常${NC}"
    echo "   HTTPステータス: $FRONTEND_RESPONSE"
else
    echo -e "${RED}❌ フロントエンド: 接続失敗${NC}"
    echo "   フロントエンドが起動しているか確認してください"
fi

echo ""
echo "テスト完了"

