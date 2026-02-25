# Task 06: 投票API改修

## Status: pending
## Depends on: 02-voter-model, 05-voter-verify-api
## PRD Section: 3

## 概要
POST /api/v1/votes に voter_token 検証ロジックを追加

## Implementation Steps
1. votes.ts の POST / ハンドラを改修
2. survey.require_registration === true の場合: voter_token 必須検証
3. voter_token で voter 検索 → status 確認 → 投票実行 → voter status を 'voted' に更新
4. require_registration === false の場合: 従来通り session_id で重複チェック

## 変更対象ファイル
- backend/src/routes/votes.ts（改修）

## Acceptance Criteria
- [ ] require_registration=true で voter_token なしなら 403
- [ ] voter_token 無効なら 404
- [ ] 既に投票済み(status='voted')なら 403
- [ ] 投票成功後に voters.status を 'voted' に更新
- [ ] require_registration=false は従来通り動作（後方互換）
