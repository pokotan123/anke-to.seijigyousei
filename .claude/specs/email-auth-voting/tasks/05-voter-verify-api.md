# Task 05: トークン検証API

## Status: pending
## Depends on: 02-voter-model
## PRD Section: 3

## 概要
GET /api/v1/voters/verify/:voter_token — トークン検証 + アンケートデータ返却

## Implementation Steps
1. voters.ts に GET /verify/:voter_token ハンドラ追加
2. voter_token でDB検索 → status確認 → アンケート取得 → 質問・選択肢取得
3. メールアドレスをマスクして返却

## 変更対象ファイル
- backend/src/routes/voters.ts（追記）

## Acceptance Criteria
- [ ] voter_token が存在しなければ 404
- [ ] status='voted' なら 403
- [ ] アンケートが published かつ投票期間内であること
- [ ] メールアドレスをマスク表示（vo***@example.com）
- [ ] アンケート + 質問 + 選択肢を一括返却
