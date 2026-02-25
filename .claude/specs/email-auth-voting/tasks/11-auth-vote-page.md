# Task 11: 認証済み投票ページ

## Status: pending
## Depends on: 05-voter-verify-api, 06-vote-api-modify
## PRD Section: 3

## 概要
/vote/auth/[voter_token] — 認証済み投票ページ（既存の /vote/[token] を参考に）

## UI開発プロセス
**モック先行**: モック作成 → ユーザー確認 → 承認後に本実装

## Implementation Steps
1. モックページ作成
2. ユーザーに確認を促す
3. 承認後にAPI接続して本実装

## 変更対象ファイル
- frontend/src/app/vote/auth/[voter_token]/page.tsx（新規）

## Acceptance Criteria
- [ ] voter_token 検証 → アンケート表示
- [ ] 同意確認モーダル
- [ ] 質問回答フォーム
- [ ] 投票完了メッセージ
- [ ] エラー（無効トークン、投票済み、期間外）
