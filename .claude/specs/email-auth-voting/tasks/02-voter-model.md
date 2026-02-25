# Task 02: Voterモデル

## Status: in_progress
## Depends on: 01-db-migration
## PRD Section: 3

## 概要
VoterModelクラスの実装（CRUD + トークン生成 + ステータス管理）

## Implementation Steps
1. `backend/src/models/Voter.ts` を新規作成
2. Voter interface定義
3. VoterModel クラス: create, findById, findByToken, findByEmail, findBySurveyId, updateStatus, markAsVoted, getSummary

## 変更対象ファイル
- backend/src/models/Voter.ts（新規）

## Acceptance Criteria
- [ ] crypto.randomUUID() + SHA-256 で64文字トークン生成
- [ ] 全CRUDメソッドがパラメータ化クエリを使用
- [ ] getSummary で status 別カウントを返却
- [ ] markAsVotedByToken で voter_token から直接更新可能
