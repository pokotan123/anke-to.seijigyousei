# Task 14: フロントエンドAPIクライアント

## Status: in_progress
## Depends on: なし
## PRD Section: 3

## 概要
api.ts に voterAPI 追加 + voteAPI に submitWithToken 追加

## Implementation Steps
1. voterAPI オブジェクト追加: register, verify, list, sendLinks, remind
2. voteAPI に submitWithToken メソッド追加

## 変更対象ファイル
- frontend/src/lib/api.ts（改修）

## Acceptance Criteria
- [ ] voterAPI.register(surveyToken, email)
- [ ] voterAPI.verify(voterToken)
- [ ] voterAPI.list(surveyId)
- [ ] voterAPI.sendLinks(surveyId)
- [ ] voterAPI.remind(surveyId)
- [ ] voteAPI.submitWithToken(data, voterToken)
