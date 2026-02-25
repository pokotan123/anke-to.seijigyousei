# Task 01: DBマイグレーション

## Status: pending

## PRD Reference: Section 4.1 (データモデル変更)

## Dependencies: なし

## Description
surveys, votes テーブルにカラム追加し、email question_type をサポートする。

## Implementation Steps

1. マイグレーションSQLファイル作成: `backend/database/migrations/002_two_survey_model.sql`
2. surveys テーブルに `linked_voting_survey_id` カラム追加（FK → surveys.id, nullable, ON DELETE SET NULL）
3. surveys テーブルにインデックス作成: `idx_surveys_linked`
4. votes テーブルに `voter_token` VARCHAR(64) カラム追加（nullable）
5. votes テーブルにインデックス作成: `idx_votes_voter_token`
6. votes テーブルに部分ユニークインデックス作成: `idx_votes_unique_voter_question` (voter_token, question_id WHERE voter_token IS NOT NULL)
7. `backend/database/init.sql` も更新（新規デプロイ用）
8. ローカルDBでマイグレーション実行・検証

## Acceptance Criteria
- [ ] surveys.linked_voting_survey_id カラムが存在し、FK制約が正しい
- [ ] votes.voter_token カラムが存在する
- [ ] 部分ユニークインデックスが正しく動作（同一voter_token + question_idで重複INSERT不可）
- [ ] voter_token=NULL の行はユニーク制約に影響しない
- [ ] 既存データに影響なし（ALTER TABLE のみ）

## Files to Modify
- `backend/database/migrations/002_two_survey_model.sql` (新規)
- `backend/database/init.sql` (更新)

## Estimated Time: 1h
