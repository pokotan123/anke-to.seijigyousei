# Task 11: フロント: 投票者管理改修

## Status: pending

## PRD Reference: Section 4.3, FR-4

## Dependencies: Task 04

## Description
投票者管理画面に登録アンケートの回答データを表示。管理者が各投票者の登録時の回答内容を確認可能に。

## Implementation Steps

1. 投票者一覧APIのレスポンスに登録アンケート回答を含める
   - voter.voter_tokenでvotesテーブルから登録survey分の回答を取得
   - 登録surveyのquestion/option情報もJOIN
2. 投票者管理画面に「登録回答」カラムを追加
3. 各投票者の行にexpandable detailとして登録回答を表示
4. 登録surveyがリンクされている場合のみ登録回答セクション表示
5. 登録回答の表示形式: question_title → 選択肢テキスト or 自由回答テキスト

## Acceptance Criteria
- [ ] 投票者一覧に登録回答情報が表示される
- [ ] 各投票者の登録回答が展開可能
- [ ] 登録surveyがない場合は登録回答セクション非表示
- [ ] 回答が正しくquestion/optionテキストで表示される
- [ ] パフォーマンス: N+1クエリ回避（バッチ取得）

## Files to Modify
- `frontend/src/app/admin/surveys/[id]/voters/page.tsx` (更新)
- `backend/src/routes/voters.ts` (更新: 登録回答データの返却)
- `frontend/src/lib/api.ts` (更新)

## Estimated Time: 1h
