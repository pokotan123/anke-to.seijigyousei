# Task 04: 投票者登録API

## Status: pending
## Depends on: 02-voter-model
## PRD Section: 3

## 概要
POST /api/v1/voters/register — 投票者がメールアドレスを登録

## Implementation Steps
1. `backend/src/routes/voters.ts` を新規作成
2. Zod スキーマでバリデーション
3. survey_token → survey 取得 → require_registration確認 → 重複チェック → 登録
4. レート制限: 1IP/15分で5回

## 変更対象ファイル
- backend/src/routes/voters.ts（新規）

## Acceptance Criteria
- [ ] Zod でメールアドレス形式チェック
- [ ] survey_token でアンケート取得、require_registration=true 確認
- [ ] registration_deadline 過ぎていないか確認
- [ ] 同一アンケート・同一メール重複で 409
- [ ] レート制限設定
