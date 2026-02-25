# Task 05: バッチ投票API

## Status: pending

## PRD Reference: Section 4.2 (POST /votes/batch), FR-3

## Dependencies: Task 01, 03

## Description
POST /api/v1/votes/batch エンドポイント新設。voter_tokenベースの認証投票を全問一括でトランザクション処理。

## Implementation Steps

1. Zodスキーマ定義: `{ voter_token: string(64, hex), answers: [{ question_id: number, option_id?: number, answer_text?: string }] }`
2. VoterModel.findByToken(voter_token) でvoter取得（見つからなければ404）
3. voter.statusチェック（'voted'なら403: 既に投票済み）
4. SurveyModel.findById(voter.survey_id) でsurvey取得 + isPublished確認
5. 全question_idがsurveyに所属するか検証
6. 各answerのoption_idがquestion_idに所属するか検証
7. BEGIN TRANSACTION
   - SELECT * FROM voters WHERE voter_token = $1 FOR UPDATE（行ロック）
   - 再度status確認（レースコンディション防止）
   - VoteModel.createBatch(client, voteInputs)
   - UPDATE voters SET status='voted' WHERE voter_token=$1 AND status IN ('sent','registered')
   - COMMIT（失敗時ROLLBACK）
8. Redisキャッシュ無効化（survey結果キャッシュ）
9. Socket.IOブロードキャスト（リアルタイム更新）
10. レスポンス: `{ message: "投票が完了しました", votes: [{ id, question_id, voted_at }] }`

## Acceptance Criteria
- [ ] voter_tokenが無効な場合404
- [ ] 既に投票済み(status='voted')の場合403
- [ ] 未公開surveyへの投票で403
- [ ] question_idがsurveyに属さない場合400
- [ ] option_idがquestion_idに属さない場合400
- [ ] SELECT FOR UPDATEで行ロック取得
- [ ] 全投票がアトミックにINSERT
- [ ] voter statusが'voted'に更新
- [ ] Socket.IOでリアルタイム通知
- [ ] 同一voter_tokenで2回目の投票が403

## Files to Modify
- `backend/src/routes/votes.ts` (更新: 新ルート追加)

## Estimated Time: 2h
