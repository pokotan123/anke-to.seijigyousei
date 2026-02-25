# Task 09: フロント: 認証投票ページ修正

## Status: pending

## PRD Reference: Section 4.3, FR-3

## Dependencies: Task 05

## Description
/vote/auth/[voter_token] の投票送信をPOST /votes/batchに変更。multiple_choiceのUI修正、エラーハンドリング改善。

## Implementation Steps

1. verify APIからsurvey情報（questions/options）を取得
2. 投票フォームのレンダリング（全問表示）
3. multiple_choiceをチェックボックスUI（ラジオボタンから変更）
4. single_choiceはラジオボタンを維持
5. text質問はテキストエリア
6. 送信: POST /api/v1/votes/batch に `{ voter_token, answers }` を送信
7. 成功画面:「投票が完了しました」
8. エラーハンドリング:
   - 403: 「既に投票済みです」（明確なメッセージ）
   - 404: 「無効な投票リンクです」
   - 400: バリデーションエラー詳細表示
9. 投票前の同意確認モーダル（既存の仕組みを維持）

## Acceptance Criteria
- [ ] verify APIからsurveyデータを正しく取得・表示
- [ ] multiple_choiceがチェックボックスで表示される
- [ ] single_choiceがラジオボタンで表示される
- [ ] 全問の回答がbatch APIに正しい形式で送信される
- [ ] 投票成功で完了画面表示
- [ ] 二重投票時に「既に投票済みです」表示
- [ ] 無効なtokenで適切なエラー表示
- [ ] 同意モーダルが正常に動作

## Files to Modify
- `frontend/src/app/vote/auth/[voter_token]/page.tsx` (更新)
- `frontend/src/lib/api.ts` (更新: batch API追加)

## Estimated Time: 1.5h
