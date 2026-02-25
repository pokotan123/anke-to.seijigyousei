# Task 08: フロント: 登録ページ再設計

## Status: pending

## PRD Reference: Section 4.3, FR-2

## Dependencies: Task 04

## Description
/register/[survey_token] を簡易メール入力フォームから完全なアンケートフォームに再設計。email質問タイプの専用レンダリング対応。

## Implementation Steps

1. 登録ページのデータ取得APIを確認（GET /api/v1/surveys/:token でquestions/options取得）
2. 投票ページ（/vote/[survey_token]）のUIコンポーネントを再利用
3. email質問タイプのレンダリング: `<input type="email">` + リアルタイムバリデーション
4. 各質問タイプのレンダリング対応（single_choice, multiple_choice, text, email）
5. フォーム送信: POST /api/v1/votes/register に全回答をバッチ送信
6. 成功画面:「登録が完了しました。投票リンクは後日メールでお届けします。」
7. エラー画面: 重複登録（409）、締切超過、不正入力
8. レスポンシブ対応（モバイルファースト）

## Acceptance Criteria
- [ ] 登録アンケートのquestions/optionsが正しく表示される
- [ ] email質問がtype="email"のinputで表示される
- [ ] 不正なメールアドレスでバリデーションエラー
- [ ] 全問回答後にsubmitで全回答をバッチ送信
- [ ] 送信成功で完了メッセージ表示
- [ ] 重複登録エラーの適切な表示
- [ ] モバイルでの表示が崩れない

## Files to Modify
- `frontend/src/app/register/[survey_token]/page.tsx` (更新)
- `frontend/src/lib/api.ts` (更新: register API追加)

## Estimated Time: 2h
