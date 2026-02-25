# Task 10: フロント: 管理画面改修（アンケート作成・編集）

## Status: pending

## PRD Reference: Section 4.3, FR-1

## Dependencies: Task 02

## Description
アンケート作成・編集画面にリンクUI（登録用→投票用アンケートの紐づけ）とemail質問タイプを追加。

## Implementation Steps

1. アンケート作成フォームに「登録用アンケートとして設定」トグル追加
2. トグルON時に投票用アンケート選択ドロップダウン表示
   - 既存の公開済みsurveyリストを取得
   - 自分自身は選択肢から除外
3. email質問タイプを質問作成UIに追加
   - 質問タイプのドロップダウンに「メールアドレス」オプション追加
   - email質問は登録用アンケートに1つ必須（バリデーション）
4. アンケート編集画面でもリンク設定を変更可能に
5. リンク先surveyの情報を表示（タイトル、状態）
6. Survey作成/更新APIにlinked_voting_survey_idを含める

## Acceptance Criteria
- [ ] 「登録用アンケートとして設定」トグルが表示される
- [ ] 投票用アンケートの選択肢が正しく表示される
- [ ] email質問タイプが選択可能
- [ ] 登録用設定時にemail質問がないとバリデーションエラー
- [ ] 作成・更新時にlinked_voting_survey_idが正しく保存される
- [ ] 編集画面で既存のリンク設定が表示される
- [ ] 自分自身をリンク先に選択できない

## Files to Modify
- `frontend/src/app/admin/surveys/new/page.tsx` (更新)
- `frontend/src/app/admin/surveys/[id]/page.tsx` (更新)
- `frontend/src/lib/api.ts` (更新)

## Estimated Time: 2h
