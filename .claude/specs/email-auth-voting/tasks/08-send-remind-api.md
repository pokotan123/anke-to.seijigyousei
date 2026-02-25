# Task 08: 一括送信・リマインドAPI

## Status: pending
## Depends on: 02-voter-model, 03-mail-service
## PRD Section: 3

## 概要
POST /voters/send-links + POST /voters/remind — 管理者がメール一括送信

## Implementation Steps
1. voters.ts に POST /send-links ハンドラ追加
2. voters.ts に POST /remind ハンドラ追加
3. MailService を使ってメール送信、結果を集計

## 変更対象ファイル
- backend/src/routes/voters.ts（追記）

## Acceptance Criteria
- [ ] send-links: status='registered' の voters にメール送信 → status='sent' に更新
- [ ] remind: status='sent' の voters にリマインド送信
- [ ] 送信結果を集計して返却 { sent, failed, errors }
- [ ] 管理者認証必須
