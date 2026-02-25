# Task 09: ルート統合 + Surveyモデル更新

## Status: pending
## Depends on: 04-voter-register-api, 05-voter-verify-api, 06-vote-api-modify, 07-voter-list-api, 08-send-remind-api
## PRD Section: 3

## 概要
index.ts にルート登録 + Survey interface/model に新フィールド追加

## Implementation Steps
1. index.ts に `app.use('/api/v1/voters', voterRoutes)` 追加
2. Survey interface に require_registration, registration_message, registration_deadline 追加
3. SurveyModel の create/update メソッドに新フィールド対応追加

## 変更対象ファイル
- backend/src/index.ts（改修）
- backend/src/models/Survey.ts（改修）

## Acceptance Criteria
- [ ] voterRoutes が /api/v1/voters で登録される
- [ ] Survey interface に3フィールド追加
- [ ] create/update で新フィールドを保存可能
