# CHANGELOG: メール認証投票機能

## 2026-02-25 — APIタイムスタンプJST化 + registration_start_date追加
- pg型パーサー(OID 1114)オーバーライドで全TIMESTAMP値をJST ISO文字列(+09:00)に変換
- surveys テーブルに `registration_start_date TIMESTAMP` カラム追加（自動マイグレーション対応）
- Survey model interface / create / update に registration_start_date 追加
- 関連PRD: two-survey-voting/PRD.md に仕様追記済み

## 2026-02-25 — Task 15 E2Eテスト・デプロイ準備 完了 → 全18タスク完了
- Playwright E2Eテスト4ファイル43テスト作成（従来フロー、メール認証フロー、管理画面、a11y）
- playwright.config.ts作成（chromium + mobile プロジェクト）
- backend .env.example 新規作成（デプロイ用環境変数リスト）
- backend .env にRESEND_API_KEY/MAIL_FROM追加
- railway.json / vercel.json / next.config.js 設定確認OK
- フロントエンド・バックエンド両方のTypeScriptビルド: エラーなし

## 2026-02-25 — Task 10-12 API接続 + Task 16-18 UI/UX改善 完了
- 7エージェント並列実行でフロントエンド全ページを改善
- Task 10: 登録ページAPI接続（surveyAPI.getByToken + voterAPI.register）
- Task 11: 認証投票ページAPI接続（voterAPI.verify + voteAPI.submitWithToken）
- Task 12: 投票者管理ページAPI接続（voterAPI.list + sendLinks + remind）
- Task 16: アクセシビリティ修正（フォームラベル、モーダルa11y、コントラスト、ARIA）
- Task 17: レスポンシブ修正（日付グリッド、テーブル横スクロール、flex-wrap）
- Task 18: デザイン統一（SVGアイコン化、色パレット統一、transition、cursor-pointer）
- alert()を全てインラインバリデーションに置換
- Unicode文字アイコン（✓, ↑, ↓, ✕）を全てSVGに置換
- globals.cssの未使用CSS変数を削除
- Next.js本番ビルド: エラーなし通過

## 2026-02-25 — UI/UXレビュー結果をSDD追加
- 5エージェント並列レビュー実施（a11y, interaction, layout, typography, consistency）
- 検出: CRITICAL 7件, HIGH 22件, MEDIUM 17件, LOW 4件
- 3タスク追加: Task 16(a11y+操作), Task 17(レスポンシブ), Task 18(デザイン統一)
- Task 15(E2E)の依存関係にTask 16-18を追加
- 設計方針: 「シンプル・使いやすい・おしゃれ」（政治投票システム向け）

## 2026-02-25 — PRD作成
- 既存設計書をベースにPRD生成
- 15タスクに分解（依存関係付き）
- UI画面はモック→承認→実装のフローを採用
- Next.jsルーティング制約により認証済み投票パスを /vote/auth/[voter_token] に決定
