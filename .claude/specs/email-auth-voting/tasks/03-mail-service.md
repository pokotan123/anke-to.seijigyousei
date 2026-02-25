# Task 03: メール送信サービス

## Status: in_progress
## Depends on: なし
## PRD Section: 3

## 概要
Resend SDKを使ったメール送信サービス + HTMLテンプレート

## Implementation Steps
1. `npm install resend` 実行
2. `backend/src/services/mail.ts` を新規作成
3. sendVoteLink(), sendReminder() を実装
4. HTML escape でXSS防止

## 変更対象ファイル
- backend/package.json（resend追加）
- backend/src/services/mail.ts（新規）

## Acceptance Criteria
- [ ] Resend SDK でメール送信
- [ ] 投票リンクメール / リマインドメールの2テンプレート
- [ ] 環境変数: RESEND_API_KEY, MAIL_FROM, FRONTEND_URL
- [ ] エラー時は { success: false, error } を返す（throw しない）
- [ ] HTML escape でユーザー入力をサニタイズ
