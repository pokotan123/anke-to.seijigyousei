# PRD: メール認証投票機能 (Email-Authenticated Voting)

## 1. Overview

### 目的
現状のアンケートシステムに「メール登録 → ユニークリンク発行 → 1人1票の保証」機能を追加し、選挙投票レベルの信頼性を実現する。

### 設計書
`docs/設計書_メール認証投票機能.md` に詳細設計あり。本PRDはその実装計画。

### 設計方針
- **完全匿名投票**: votesテーブルにvoter_idを保持しない
- **投票者自己登録**: 投票者が自分でメール登録
- **管理者主導の送信**: 投票リンク送信は管理者がコントロール
- **後方互換**: require_registration=false のアンケートは従来通り

---

## 2. Project Rules

### アーキテクチャ
- Backend: Express.js + TypeScript (Railway)
- Frontend: Next.js 14 App Router + Tailwind CSS (Vercel)
- DB: PostgreSQL 15, Cache: Redis 7, Realtime: Socket.IO
- モデルパターン: クラスベース（XxxModelクラスにstaticメソッド）
- ルート登録: index.tsでapp.use()
- マイグレーション: database/init.sqlに追記 + migrate.tsで実行

### コーディングスタイル
- イミュータブルパターン必須
- 関数50行以下、ファイル800行以下
- エラーハンドリング必須、console.log禁止
- 入力バリデーション必須（Zod使用）

### UI開発プロセス
- **新規画面は必ずモック先行**: モック作成 → ユーザーに確認 → 承認後に本実装

---

## 3. Task Breakdown

| # | タスク | 依存 | 推定 | 概要 |
|---|--------|------|------|------|
| 01 | DBマイグレーション | なし | 1h | votersテーブル新規 + surveysカラム追加 |
| 02 | Voterモデル | 01 | 1h | CRUD + トークン生成 + ステータス管理 |
| 03 | メール送信サービス | なし | 1h | Resend SDK + テンプレート |
| 04 | 投票者登録API | 02 | 1.5h | POST /voters/register（Zod + レート制限） |
| 05 | トークン検証API | 02 | 1h | GET /voters/verify/:voter_token |
| 06 | 投票API改修 | 02,05 | 1.5h | POST /votes にvoter_token検証追加 |
| 07 | 投票者一覧API | 02 | 0.5h | GET /voters（管理者用） |
| 08 | 一括送信・リマインドAPI | 02,03 | 1.5h | send-links + remind |
| 09 | ルート統合 + Surveyモデル更新 | 04-08 | 0.5h | index.ts登録 + Survey型拡張 |
| 10 | メール登録フォームページ | 04 | 1.5h | /register/[survey_token] **[モック→承認→実装]** |
| 11 | 認証済み投票ページ | 05,06 | 2h | /vote/auth/[voter_token] **[モック→承認→実装]** |
| 12 | 投票者管理画面 | 07,08 | 2h | /admin/surveys/[id]/voters **[モック→承認→実装]** |
| 13 | アンケート作成/編集改修 | 01 | 1.5h | require_registration等のフォーム追加 **[モック→承認→実装]** |
| 14 | フロントエンドAPIクライアント | なし | 0.5h | api.tsにvoterAPI追加 |
| 15 | E2Eテスト・デプロイ | 全タスク | 2h | 一連フローのテスト + Railway/Vercel |

**合計: 約16時間（2.5日）**

---

## 4. 実行順序（並列化）

```
Phase 1（並列）: 01 + 03 + 14
Phase 2（01完了後）: 02
Phase 3（並列）: 04 + 05 + 07 + 08 + 13
Phase 4（05完了後）: 06
Phase 5（全API完了後）: 09
Phase 6（モック→承認→実装）: 10 + 11 + 12
Phase 7: 15
```

---

## 5. 注意点

- Next.jsルーティング制約: /vote/[token]と/vote/[survey_token]は競合するため、認証済み投票は /vote/auth/[voter_token] を使用
- npm追加パッケージ: resend, zod
- 環境変数追加: RESEND_API_KEY, MAIL_FROM, FRONTEND_URL
