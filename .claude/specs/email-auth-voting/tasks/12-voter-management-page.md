# Task 12: 投票者管理画面

## Status: pending
## Depends on: 07-voter-list-api, 08-send-remind-api
## PRD Section: 3

## 概要
/admin/surveys/[id]/voters — 管理者用の投票者管理画面

## UI開発プロセス
**モック先行**: モック作成 → ユーザー確認 → 承認後に本実装

## Implementation Steps
1. モックページ作成
2. ユーザーに確認を促す
3. 承認後にAPI接続して本実装

## 変更対象ファイル
- frontend/src/app/admin/surveys/[id]/voters/page.tsx（新規）

## Acceptance Criteria
- [ ] 投票者一覧テーブル（メール、ステータス、日時）
- [ ] ステータス別サマリー表示
- [ ] 投票リンク一括送信ボタン
- [ ] リマインドメール送信ボタン
- [ ] 登録フォームURL表示・コピー
