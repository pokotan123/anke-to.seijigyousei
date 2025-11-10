# GitHub CLI インストールガイド

## 方法1: Homebrewを使用（推奨）

ターミナルで以下のコマンドを実行してください：

```bash
# Homebrewをインストール（初回のみ）
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# インストール後、パスを設定（Apple Silicon Macの場合）
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc

# GitHub CLIをインストール
brew install gh
```

## 方法2: 直接ダウンロード

1. [GitHub CLI リリースページ](https://github.com/cli/cli/releases/latest)にアクセス
2. macOS用の`.pkg`ファイルをダウンロード
3. ダウンロードしたファイルをダブルクリックしてインストール

## インストール後の認証

インストール後、以下のコマンドで認証してください：

```bash
gh auth login
```

認証方法を選択：
- **GitHub.com** を選択
- **HTTPS** を選択
- **ブラウザで認証** を選択（推奨）
- ブラウザで認証を完了

## インストール確認

```bash
gh --version
```

バージョンが表示されればインストール成功です。

