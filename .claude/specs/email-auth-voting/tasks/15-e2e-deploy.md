# Task 15: E2Eテスト・デプロイ

## Status: pending
## Depends on: 09, 10, 11, 12, 13, 14
## PRD Section: 3

## 概要
一連フローのE2Eテスト + Railway/Vercel デプロイ

## Implementation Steps
1. 登録 → メール受信 → 投票の一連フローテスト
2. Railway 環境変数設定（RESEND_API_KEY, MAIL_FROM）
3. ビルド確認 + デプロイ

## 変更対象ファイル
- テストファイル（新規）
- 環境設定

## Acceptance Criteria
- [ ] 登録→投票の一連フローが動作
- [ ] 後方互換: 従来の投票フローも動作
- [ ] ビルドエラーなし
