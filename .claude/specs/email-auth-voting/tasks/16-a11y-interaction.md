# Task 16: アクセシビリティ・インタラクション修正

## Status: pending
## Depends on: 10, 11, 12, 13
## PRD Section: UI/UX Review (2026-02-25)
## Priority: CRITICAL

## 概要
5エージェントUI/UXレビューで検出されたアクセシビリティとインタラクションの問題を修正。
WCAG AA準拠・タッチ操作の改善を行う。

## 設計方針
政治投票システム → シンプル・使いやすい・おしゃれ

## Implementation Steps

### A. フォームラベルの修正 (CRITICAL)
1. **admin/login/page.tsx**: `<label>`に`htmlFor`、`<input>`に`id`を追加
2. **admin/surveys/new/page.tsx**: 全フォーム入力に`htmlFor`/`id`ペアを設定
3. **admin/surveys/[id]/page.tsx**: 全フォーム入力に`htmlFor`/`id`ペアを設定
4. **register/[survey_token]/page.tsx**: カスタム登録項目の動的inputにも`id`を設定
5. **vote/[token]/page.tsx**: textarea質問に`<label>`を関連付け

### B. モーダルのアクセシビリティ (CRITICAL)
1. **vote/[token]/page.tsx 同意モーダル**: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`を追加。Escキー・背景クリックで閉じる。フォーカストラップ実装
2. **admin/surveys/[id]/page.tsx 質問編集モーダル**: 同上
3. **admin/surveys/[id]/page.tsx 選択肢編集モーダル**: 同上

### C. コントラスト修正 (CRITICAL)
1. **register/[survey_token]/page.tsx:197**: `text-gray-400`→`text-gray-500`（4.5:1以上確保）
2. **vote/auth/[voter_token]/page.tsx:253**: `text-gray-400`→`text-gray-500`

### D. タッチターゲット拡大 (HIGH)
1. **admin/dashboard/page.tsx**: CSV・削除ボタンを`py-2 px-3`以上に拡大（44px確保）
2. **admin/surveys/[id]/page.tsx**: 質問・選択肢の↑↓ボタンを`p-2`以上に
3. **admin/surveys/new/page.tsx + [id]/page.tsx**: 登録項目「削除」ボタンに`py-1.5`追加
4. **admin/surveys/new/page.tsx + [id]/page.tsx**: 「+ 項目を追加」に`py-2 px-3`パディング追加
5. **admin/login/page.tsx**: 送信ボタンを`py-3`に拡大

### E. cursor-pointer追加 (HIGH)
1. **admin/dashboard/page.tsx**: ログアウトボタンに`cursor-pointer`
2. 全ページ: ナビバックボタン(`← 一覧に戻る`)に`cursor-pointer`
3. **vote/auth/[voter_token]/page.tsx**: 「同意して投票する」に`cursor-pointer`

### F. ARIAとセマンティクス (HIGH)
1. 全`<table>`の`<th>`に`scope="col"`追加
2. **admin/dashboard/page.tsx**: `<nav>`に`aria-label="管理メニュー"`
3. **admin/votes/page.tsx**: フィルタリセット「✕」に`aria-label="フィルタをクリア"`
4. **admin/surveys/[id]/page.tsx**: ↑↓ボタンに`aria-label="上へ移動"`等
5. ローディングスピナーに`role="status"` + `aria-label="読み込み中"`
6. **admin/surveys/[id]/voters/page.tsx**: 成功/エラーメッセージに`role="alert"`

### G. キーボード・トランジション (MEDIUM)
1. ホバー色変更にすべて`transition-colors duration-200`追加
2. **vote/[token]/page.tsx**: 投票ボタンに`transition`追加
3. **vote/[token]/page.tsx**: `alert()`→インラインエラー表示に変更

## 変更対象ファイル
- frontend/src/app/admin/login/page.tsx
- frontend/src/app/admin/dashboard/page.tsx
- frontend/src/app/admin/surveys/new/page.tsx
- frontend/src/app/admin/surveys/[id]/page.tsx
- frontend/src/app/admin/surveys/[id]/voters/page.tsx
- frontend/src/app/admin/votes/page.tsx
- frontend/src/app/vote/[token]/page.tsx
- frontend/src/app/vote/auth/[voter_token]/page.tsx
- frontend/src/app/register/[survey_token]/page.tsx

## Acceptance Criteria
- [ ] 全フォーム入力にプログラム的ラベル関連付け（htmlFor/id）
- [ ] 全モーダルにrole="dialog" + フォーカストラップ
- [ ] WCAG AA コントラスト比4.5:1以上（全テキスト）
- [ ] 全タッチターゲット44px以上
- [ ] 全クリック要素にcursor-pointer
- [ ] テーブルヘッダーにscope="col"
- [ ] alert()をインラインエラーに置換
