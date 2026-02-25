# Task 10: メール登録フォームページ

## Status: pending
## Depends on: 04-voter-register-api
## PRD Section: 3

## 概要
/register/[survey_token] — 投票者がメールを登録するフォーム

## UI開発プロセス
**モック先行**: モック作成 → ユーザー確認 → 承認後に本実装

## Implementation Steps
1. モックページ作成（ダミーデータ、API未接続）
2. ユーザーに確認を促す
3. 承認後にAPI接続して本実装

## 変更対象ファイル
- frontend/src/app/register/[survey_token]/page.tsx（新規）

## Acceptance Criteria
- [ ] アンケートタイトル・説明表示
- [ ] メールアドレス入力フォーム
- [ ] 登録完了メッセージ
- [ ] エラー表示（重複、締切超過）
