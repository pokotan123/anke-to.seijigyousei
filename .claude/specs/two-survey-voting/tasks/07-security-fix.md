# Task 07: セキュリティ修正

## Status: pending

## PRD Reference: NFR-1

## Dependencies: Task 06

## Description
5エージェント調査で検出されたセキュリティ脆弱性を修正。レート制限、CSRF改善、エラーメッセージ修正。

## Implementation Steps

1. POST /votes にvoteRateLimit適用（50回/15分）
2. GET /voters/verify/:voter_token にレート制限適用
3. POST /votes/batch にレート制限適用
4. POST /votes/register にレート制限適用
5. voters.ts の catch ブロックからスタックトレース等の内部情報を除去
6. `generateCSRFToken()` を `Math.random()` から `crypto.randomBytes(32).toString('hex')` に変更
7. voter_tokenのZodバリデーション: `.string().length(64).regex(/^[a-f0-9]{64}$/)`

## Acceptance Criteria
- [ ] 投票エンドポイントにレート制限が適用されている
- [ ] verify エンドポイントにレート制限が適用されている
- [ ] エラーレスポンスに内部情報（スタックトレース、DB情報）が含まれない
- [ ] CSRFトークンがcrypto.randomBytesで生成される
- [ ] voter_tokenが正しい形式（64文字hex）以外で400

## Files to Modify
- `backend/src/routes/votes.ts` (更新)
- `backend/src/routes/voters.ts` (更新)
- `backend/src/middleware/security.ts` (更新)
- `backend/src/index.ts` (更新: レート制限有効化)

## Estimated Time: 1h
