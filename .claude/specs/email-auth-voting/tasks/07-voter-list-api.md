# Task 07: 投票者一覧API

## Status: pending
## Depends on: 02-voter-model
## PRD Section: 3

## 概要
GET /api/v1/voters?survey_id=X — 管理者用投票者一覧

## Implementation Steps
1. voters.ts に GET / ハンドラ追加（authenticateToken必須）
2. survey_id パラメータで投票者一覧取得
3. summary（status別カウント）も一緒に返却

## 変更対象ファイル
- backend/src/routes/voters.ts（追記）

## Acceptance Criteria
- [ ] 管理者認証必須
- [ ] survey_id でフィルタ
- [ ] voters 配列 + summary オブジェクトを返却
