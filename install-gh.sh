#!/bin/bash

echo "🚀 GitHub CLI インストールスクリプト"
echo ""

# Homebrewの確認
if ! command -v brew &> /dev/null; then
    echo "Homebrewがインストールされていません。"
    echo ""
    echo "Homebrewをインストールしますか？ (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo ""
        echo "Homebrewをインストール中..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        
        # Apple Silicon Macの場合のパス設定
        if [ -f "/opt/homebrew/bin/brew" ]; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
    else
        echo "Homebrewのインストールをスキップしました。"
        echo "手動でインストールしてください: https://brew.sh"
        exit 1
    fi
fi

# GitHub CLIのインストール
echo ""
echo "GitHub CLIをインストール中..."
brew install gh

# インストール確認
if command -v gh &> /dev/null; then
    echo ""
    echo "✅ GitHub CLIのインストールが完了しました！"
    echo ""
    echo "次のステップ:"
    echo "  gh auth login"
    echo ""
    echo "認証後、以下のコマンドでリポジトリを作成してプッシュできます:"
    echo "  gh repo create survey-system --public --source=. --remote=origin --push"
else
    echo "❌ インストールに失敗しました"
    exit 1
fi
