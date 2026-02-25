# Task 13: アンケート作成/編集改修

## Status: pending
## Depends on: 01-db-migration
## PRD Section: 3

## 概要
アンケート作成・編集フォームに require_registration 等のオプション追加

## UI開発プロセス
**モック先行**: モック作成 → ユーザー確認 → 承認後に本実装

## Implementation Steps
1. モックで追加UIを作成
2. ユーザーに確認を促す
3. 承認後にAPI接続して本実装

## 変更対象ファイル
- frontend/src/app/admin/surveys/new/page.tsx（改修）
- frontend/src/app/admin/surveys/[id]/page.tsx（改修）

## Acceptance Criteria
- [ ] 「メール登録を必須にする」チェックボックス
- [ ] 有効時: 登録案内文テキストエリア + 登録締め切り日時ピッカー
- [ ] 投票者管理画面へのリンク表示
