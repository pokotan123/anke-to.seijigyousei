# Task 06: 既存API修正

## Status: pending

## PRD Reference: Section 4.2 (改修), NFR-1

## Dependencies: Task 01

## Description
既存のPOST /votesとGET /voters/verifyを修正。匿名投票ガード、レスポンス改善、Zodバリデーション追加。

## Implementation Steps

### POST /api/v1/votes 修正
1. require_registration=true のsurveyへの匿名投票を403ブロック
2. Zodバリデーション追加（survey_token, question_id, option_id, answer_text）
3. option_idがquestion_idに所属するか検証ロジック追加

### GET /api/v1/voters/verify/:voter_token 修正
4. レスポンスに `survey.unique_token`（survey_token）を追加
5. レスポンスに `voter.voter_token` をエコーバック
6. surveyの全questions + optionsをレスポンスに含める（フロントで投票フォーム表示用）

## Acceptance Criteria
- [ ] require_registration=trueのsurveyに匿名投票→403
- [ ] require_registration=falseのsurveyは従来通り動作
- [ ] 不正なoption_id（別questionのoption）で400
- [ ] verify endpointがsurvey_tokenを返す
- [ ] verify endpointがvoter_tokenをエコーバック
- [ ] verify endpointがsurveyのquestions情報を返す
- [ ] Zodバリデーションで不正入力を弾く

## Files to Modify
- `backend/src/routes/votes.ts` (更新)
- `backend/src/routes/voters.ts` (更新)

## Estimated Time: 1.5h
