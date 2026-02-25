# Task 01: DBマイグレーション

## Status: in_progress
## Depends on: なし
## PRD Section: 3 (Task Breakdown)

## 概要
votersテーブルの新規作成 + surveysテーブルへのカラム追加

## Implementation Steps
1. `backend/database/init.sql` に voters テーブル定義を追記
2. surveys テーブルに require_registration, registration_message, registration_deadline カラム追加
3. `backend/database/migrations/add_voters_table.sql` を作成（既存DB用）

## 変更対象ファイル
- backend/database/init.sql（追記）
- backend/database/migrations/add_voters_table.sql（新規）

## Acceptance Criteria
- [ ] voters テーブルが IF NOT EXISTS で作成される
- [ ] surveys に3カラムが安全に追加される（DO $$ ブロック）
- [ ] インデックスが作成される
- [ ] マイグレーションファイルが独立して実行可能
