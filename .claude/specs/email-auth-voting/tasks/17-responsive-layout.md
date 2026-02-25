# Task 17: レスポンシブ・レイアウト修正

## Status: pending
## Depends on: 10, 11, 12, 13
## PRD Section: UI/UX Review (2026-02-25)
## Priority: CRITICAL

## 概要
モバイル対応とレイアウトの問題を修正。375px〜1440pxで正常表示を保証。

## 設計方針
政治投票システム → モバイルでの投票・登録が多いため、モバイルファーストで改善

## Implementation Steps

### A. 日付入力のレスポンシブ化 (CRITICAL)
1. **admin/surveys/new/page.tsx:111**: `grid-cols-2`→`grid-cols-1 sm:grid-cols-2`
2. **admin/surveys/[id]/page.tsx:363**: 同上

### B. テーブルのモバイル対応 (CRITICAL)
1. **admin/surveys/[id]/voters/page.tsx:158**: テーブルに`overflow-x-auto`ラッパー追加
2. **admin/votes/page.tsx**: 投票データテーブルに同様の対応確認

### C. ナビゲーションのモバイル対応 (HIGH)
1. **admin/dashboard/page.tsx:114**: ナビリンクに`flex-wrap`追加、またはモバイルでハンバーガーメニュー化
2. 全管理ページのナビヘッダーを統一（`<nav className="bg-white shadow">`+ `h-16`）

### D. コンテンツオーバーフロー修正 (HIGH)
1. **admin/dashboard/page.tsx:162**: 投票URL表示に`truncate`または`break-all`追加
2. **admin/surveys/[id]/page.tsx:533**: 投票URL行を`flex-wrap`対応
3. **vote/[token]/page.tsx:192**: 同意モーダルに`overflow-y-auto max-h-[90vh]`追加
4. **page.tsx:13**: ボタン行に`flex-wrap`追加

### E. モバイルレイアウト調整 (MEDIUM)
1. **vote/auth/[voter_token]/page.tsx:251**: ヘッダーを`flex-wrap`対応、メールを別行に
2. **admin/surveys/[id]/voters/page.tsx:93**: グリッドを`grid-cols-2 sm:grid-cols-3 md:grid-cols-5`に変更
3. **admin/surveys/[id]/page.tsx:581**: 質問アクションボタンをモバイルで折り返し

### F. コンテナ幅統一 (MEDIUM)
1. 全管理ページの`max-w`を`max-w-7xl`に統一（voters pageが`max-w-6xl`）

## 変更対象ファイル
- frontend/src/app/page.tsx
- frontend/src/app/admin/dashboard/page.tsx
- frontend/src/app/admin/surveys/new/page.tsx
- frontend/src/app/admin/surveys/[id]/page.tsx
- frontend/src/app/admin/surveys/[id]/voters/page.tsx
- frontend/src/app/admin/votes/page.tsx
- frontend/src/app/vote/[token]/page.tsx
- frontend/src/app/vote/auth/[voter_token]/page.tsx

## Acceptance Criteria
- [ ] datetime-localがモバイル(375px)で正常操作可能
- [ ] テーブルがモバイルで横スクロール可能（ページ全体は横スクロールしない）
- [ ] ナビゲーションがモバイルで正常表示
- [ ] URLテキストがオーバーフローしない
- [ ] モーダルが短いビューポートでもスクロール可能
- [ ] 全ページ375px/768px/1024px/1440pxで正常表示
