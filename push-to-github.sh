#!/bin/bash

# GitHubにプッシュするスクリプト

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo "🚀 GitHubにプッシュします..."
echo ""

# GitHub CLIの確認
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLIが見つかりません"
    echo "インストールしてください: brew install gh"
    exit 1
fi

# 認証状態の確認
if ! gh auth status &> /dev/null; then
    echo "⚠️  GitHub CLIが認証されていません"
    echo ""
    echo "認証を開始します..."
    gh auth login
    
    if [ $? -ne 0 ]; then
        echo "❌ 認証に失敗しました"
        exit 1
    fi
fi

echo "✅ 認証済み"
echo ""

# リポジトリ名の入力
read -p "リポジトリ名を入力してください (デフォルト: survey-system): " REPO_NAME
REPO_NAME=${REPO_NAME:-survey-system}

echo ""
echo "リポジトリを作成してプッシュします..."
echo "リポジトリ名: $REPO_NAME"
echo ""

# リポジトリの作成とプッシュ
gh repo create "$REPO_NAME" --public --source=. --remote=origin --push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ GitHubにプッシュしました！"
    echo ""
    echo "リポジトリURL:"
    gh repo view --web
else
    echo ""
    echo "❌ プッシュに失敗しました"
    echo ""
    echo "既にリポジトリが存在する場合は、以下のコマンドで手動でプッシュしてください:"
    echo "  git remote add origin https://github.com/YOUR_USERNAME/$REPO_NAME.git"
    echo "  git push -u origin main"
    exit 1
fi

