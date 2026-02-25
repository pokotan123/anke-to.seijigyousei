# Task 18: デザイン統一・洗練

## Status: pending
## Depends on: 16, 17
## PRD Section: UI/UX Review (2026-02-25)
## Priority: HIGH

## 概要
デザインの一貫性を確保し、政治投票システムにふさわしい「シンプルで使いやすくおしゃれ」なUIに統一。

## 設計方針
- 政治投票システム: 信頼感・清潔感・シンプルさ
- tailwind.config.jsの`primary`カラーを活用
- 日本語テキストに最適なline-height
- エラー・成功・ローディング状態の統一パターン

## Implementation Steps

### A. カラーパレット統一 (HIGH)
1. ハードコードされた`blue-600`/`blue-700`を`primary-600`/`primary-700`に置換（全ページ）
2. エラーアラートスタイルを統一: `bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700`
3. 一回限りの色（amber, yellow-600）を排除し、primary/gray/red/greenに限定
4. 成功アラートスタイル統一: `bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700`

### B. アイコンの統一 (HIGH)
1. Unicode文字（✓, ↑, ↓, ✕）を全てインラインSVGに置換
2. 成功状態: SVGチェックマーク（緑の丸 + チェック）に統一
3. エラー状態: SVG Xマーク（赤の丸 + X）に統一
4. 並べ替え: SVG ChevronUp/ChevronDown に統一
5. フィルタクリア: SVG Xアイコンに統一

### C. タイポグラフィ統一 (HIGH)
1. 全ページのbody/paragraphテキストに`leading-relaxed`（1.625）追加
2. h1: `text-xl font-bold`に統一（投票ページ間のtext-3xl vs text-xlを解消）
3. h2: `text-lg font-semibold`に統一（同一ページ内の2xl/xlバラつき解消）
4. フォームラベル: `text-sm font-medium text-gray-700`に統一（loginのfont-bold修正）

### D. コンポーネントパターン統一 (MEDIUM)
1. **ボタンパディング**: primary=`py-3 px-4`, secondary=`py-2 px-4`に統一
2. **disabled状態**: `disabled:bg-gray-300 disabled:cursor-not-allowed`に統一（opacity-50廃止）
3. **input padding**: admin=`px-3 py-2`, public=`px-4 py-3`のルール明確化
4. **カード影**: admin=`shadow`, public=`shadow-lg`に統一
5. **カード角丸**: admin=`rounded-lg`, public=`rounded-xl`に統一
6. **ローディングスピナー**: `h-10 w-10`に統一

### E. 空状態・フィードバック (HIGH)
1. **admin/dashboard/page.tsx**: アンケート0件時の空状態表示（イラスト + 作成ボタン）
2. **admin/votes/page.tsx**: CSV/Excelエクスポートにローディング状態追加

### F. ナビヘッダー統一 (MEDIUM)
1. 全管理ページのヘッダー構造を統一: `<nav className="bg-white shadow"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex justify-between h-16">...`
2. バックボタンの色を`text-gray-600 hover:text-gray-800`に統一
3. ナビリンクにhoverトランジション`transition-colors duration-200`追加

### G. globals.css整理 (LOW)
1. 未使用のCSS変数(`--foreground-rgb`, `--background-start-rgb`)を削除

## 変更対象ファイル
- frontend/tailwind.config.js（確認）
- frontend/src/app/globals.css
- frontend/src/app/page.tsx
- frontend/src/app/admin/login/page.tsx
- frontend/src/app/admin/dashboard/page.tsx
- frontend/src/app/admin/surveys/new/page.tsx
- frontend/src/app/admin/surveys/[id]/page.tsx
- frontend/src/app/admin/surveys/[id]/voters/page.tsx
- frontend/src/app/admin/votes/page.tsx
- frontend/src/app/admin/analytics/page.tsx
- frontend/src/app/vote/[token]/page.tsx
- frontend/src/app/vote/auth/[voter_token]/page.tsx
- frontend/src/app/register/[survey_token]/page.tsx

## Acceptance Criteria
- [ ] 全ボタン・リンクの色がprimaryパレットまたはgray/red/greenのみ使用
- [ ] Unicode文字のアイコンがゼロ（全てSVG）
- [ ] 同種の要素（エラー、成功、ボタン、カード）が全ページで同一スタイル
- [ ] 日本語テキストにleading-relaxed適用
- [ ] 見出しサイズがページ間で統一
- [ ] フォームラベルスタイルが統一
- [ ] 空状態が適切に表示される
- [ ] 全管理ページのナビヘッダー構造が統一
