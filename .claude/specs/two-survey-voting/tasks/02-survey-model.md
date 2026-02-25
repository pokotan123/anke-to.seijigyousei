# Task 02: Surveyモデル更新

## Status: pending

## PRD Reference: Section 4.1, FR-1

## Dependencies: Task 01

## Description
SurveyModelに2アンケートモデル関連のメソッドを追加。linked_voting_survey_idのCRUD、登録用survey検索、バリデーション。

## Implementation Steps

1. `SurveyModel` に `linked_voting_survey_id` フィールドをインターフェースに追加
2. `create()` / `update()` で `linked_voting_survey_id` を保存可能に
3. `findRegistrationSurveys()` 追加: linked_voting_survey_id IS NOT NULLのsurveyを取得
4. `findByLinkedVotingSurveyId(surveyId)` 追加: 特定の投票surveyにリンクされた登録surveyを取得
5. `linkToVotingSurvey(registrationSurveyId, votingSurveyId)` 追加
6. バリデーション: 自己参照防止（linked_voting_survey_id !== self.id）
7. バリデーション: 投票用surveyが存在し公開済みか確認
8. Zodスキーマ更新

## Acceptance Criteria
- [ ] linked_voting_survey_id の設定・取得・更新が正常に動作
- [ ] findRegistrationSurveys() が登録用surveyのみを返す
- [ ] 自己参照時にエラーを返す
- [ ] 存在しないsurvey_idへのリンク時にエラーを返す
- [ ] 既存のCRUD操作に影響なし

## Files to Modify
- `backend/src/models/Survey.ts` (更新)

## Estimated Time: 1h
