# Task 03: VoteModel更新

## Status: pending

## PRD Reference: Section 4.2, FR-5

## Dependencies: Task 01

## Description
VoteModelにバッチ作成、voter_token対応、認証投票用の重複チェックメソッドを追加。

## Implementation Steps

1. `CreateVoteInput` インターフェースに `voter_token?: string` 追加
2. `createBatch(client: PoolClient, inputs: CreateVoteInput[])` 追加: トランザクション内で全投票を一括INSERT
3. `hasVotedByToken(voterToken: string, questionId: number)` 追加: voter_tokenベースの重複チェック
4. `findByVoterToken(voterToken: string)` 追加: voter_tokenに紐づく全投票を取得
5. 既存の `create()` にvoter_tokenの保存処理を追加
6. INSERT文にvoter_tokenカラムを含める

## Acceptance Criteria
- [ ] createBatch() が複数投票を1トランザクションでINSERT可能
- [ ] createBatch() がPoolClientを受け取り外部トランザクションに参加可能
- [ ] hasVotedByToken() が正しく重複検知
- [ ] 既存の匿名投票（voter_token=null）に影響なし
- [ ] findByVoterToken() が正しく投票一覧を返す

## Files to Modify
- `backend/src/models/Vote.ts` (更新)

## Estimated Time: 1h
