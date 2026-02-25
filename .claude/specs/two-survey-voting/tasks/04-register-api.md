# Task 04: 登録アンケート回答API

## Status: pending

## PRD Reference: Section 4.2 (POST /votes/register), FR-2

## Dependencies: Task 01, 02, 03

## Description
POST /api/v1/votes/register エンドポイント新設。登録アンケートの回答保存とvoter作成をトランザクションで一括実行。

## Implementation Steps

1. Zodスキーマ定義: `{ survey_token: string, answers: [{ question_id: number, option_id?: number, answer_text?: string }] }`
2. survey_tokenからsurvey取得
3. linked_voting_survey_idの存在確認（なければ400）
4. email質問を特定（question_type === 'email'）しメールアドレスを抽出
5. メールアドレスのバリデーション（Zod email）
6. 重複チェック: voters テーブルに同一email + 投票survey_idの組み合わせ
7. BEGIN TRANSACTION
   - 全回答をvotesテーブルにINSERT（登録survey_id、voter_tokenをセッションID代わりに設定）
   - votersテーブルにINSERT（投票survey_id, email, voter_token, status='registered'）
   - COMMIT
8. レスポンス: `{ message: "登録が完了しました。投票リンクは後日メールでお届けします。" }`

## Acceptance Criteria
- [ ] survey_tokenから正しいsurveyを取得できる
- [ ] linked_voting_survey_idがないsurveyへのリクエストで400エラー
- [ ] email質問がないアンケートでエラー
- [ ] 重複メールで409エラー
- [ ] 回答がvotesテーブルに保存される
- [ ] voterがvotersテーブルに作成される（投票survey_id側）
- [ ] voter_tokenが64文字hex
- [ ] トランザクションがアトミック（途中失敗で全ROLLBACK）

## Files to Modify
- `backend/src/routes/votes.ts` (更新: 新ルート追加)
- `backend/src/models/Voter.ts` (更新: createWithClient追加)

## Estimated Time: 2h
