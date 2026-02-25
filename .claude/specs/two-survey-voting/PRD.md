# PRD: 2アンケートモデル投票システム (Two-Survey Voting)

## 1. Overview

### 目的
現在の「1つのsurveyに登録設定がぶら下がる」設計を、**登録用アンケートと投票用アンケートを独立した2つのsurveyとして管理する設計**に再構築する。同時に、認証投票フローの4つの重大バグとセキュリティ脆弱性を修正する。

### 設計方針
- **登録フォーム = 本物のsurvey**: 質問・選択肢を自由に設定可能
- **2つのsurveyの紐づけ**: 登録survey → 投票survey をリンク
- **1人1票の保証**: 1メール = 1トークン = 1票（DBトランザクション保護）
- **完全匿名投票**: votesテーブルにvoter_idを保持しない（voter_tokenのみ）
- **後方互換**: 既存の匿名投票フローは変更なし

### 前提知識
- 設計書: `docs/アンケートシステム_設計書.pptx`
- 前回SDD: `.claude/specs/email-auth-voting/`（全18タスク完了済み）

---

## 2. Project Rules

### アーキテクチャ
- Backend: Express.js + TypeScript (Railway)
- Frontend: Next.js 14 App Router + Tailwind CSS (Vercel)
- DB: PostgreSQL 15, Cache: Redis 7, Realtime: Socket.IO
- モデルパターン: クラスベース（staticメソッド）
- バリデーション: Zod
- メール配信: Resend

### コーディングスタイル
- イミュータブルパターン必須
- 関数50行以下、ファイル800行以下
- 入力バリデーション必須（Zod）

---

## 3. Requirements

### FR (機能要件)

#### FR-1: 2アンケートモデル
- FR-1.1: surveysテーブルに `linked_voting_survey_id` カラム追加（FK → surveys.id、nullable）
- FR-1.2: `linked_voting_survey_id` が設定されたsurveyは「登録用アンケート」として機能
- FR-1.3: questionsに `question_type = 'email'` を追加。登録用アンケートに必須1つ
- FR-1.4: 既存の `require_registration`, `registration_fields`, `registration_message`, `registration_deadline` は残す（登録締切等で使用）

#### FR-2: 登録用アンケート回答フロー
- FR-2.1: 登録用アンケートの回答は votes テーブルに保存（通常の投票と同じ）
- FR-2.2: email質問の回答からメールアドレスを抽出し、votersテーブルにレコード作成
- FR-2.3: voter_token（SHA256, 64文字）を自動生成
- FR-2.4: 同一メールでの重複登録を防止（UNIQUE制約: survey_id + email、survey_idは投票用survey側）
- FR-2.5: 登録完了メッセージ:「登録完了しました。投票リンクは後日メールでお届けします。」

#### FR-3: バッチ投票エンドポイント（バグ修正含む）
- FR-3.1: `POST /api/v1/votes/batch` 新設
- FR-3.2: リクエスト: `{ voter_token, answers: [{ question_id, option_id?, answer_text? }] }`
- FR-3.3: voter_tokenからsurvey_idを導出（survey_token不要）
- FR-3.4: 全回答をPostgreSQLトランザクションで一括INSERT
- FR-3.5: voter status更新（→ 'voted'）もトランザクション内で実行
- FR-3.6: レースコンディション防止: `SELECT ... FOR UPDATE` + `WHERE status IN ('sent', 'registered')`

#### FR-4: 投票者管理
- FR-4.1: 管理者が投票リンクを一括送信（既存機能の維持）
- FR-4.2: リマインドメール送信（既存機能の維持）
- FR-4.3: 投票者管理画面に登録用アンケートの回答も表示

#### FR-5: 1人1回投票の保証
- FR-5.1: votersテーブルの status='voted' で二重投票を防止
- FR-5.2: votesテーブルに `voter_token` カラム追加（部分UNIQUE INDEX: voter_token + question_id WHERE voter_token IS NOT NULL）
- FR-5.3: 匿名投票の重複チェックは既存の session_id ベースを維持

### NFR (非機能要件)

#### NFR-1: セキュリティ（5エージェント調査結果を反映）
- NFR-1.1: POST /votes にレート制限適用（voteRateLimit: 50/15min）
- NFR-1.2: GET /voters/verify/:voter_token にレート制限適用
- NFR-1.3: Zodバリデーションを votes.ts に追加（voter_token長さ64、hex形式）
- NFR-1.4: option_idがquestion_idに所属するか検証
- NFR-1.5: エラーメッセージから内部情報を除去（voters.ts の catch ブロック）
- NFR-1.6: CSRF トークン生成を crypto.randomBytes に変更
- NFR-1.7: 匿名投票でrequire_registration=trueのsurveyへの投票を403ブロック

#### NFR-2: パフォーマンス
- NFR-2.1: バッチ投票は1トランザクションで完了（N+1クエリ回避）
- NFR-2.2: 登録用アンケート回答 + voter作成も1トランザクション

---

## 4. Technical Design

### 4.1 データモデル変更

```sql
-- surveys テーブル: 新カラム追加
ALTER TABLE surveys ADD COLUMN linked_voting_survey_id INTEGER REFERENCES surveys(id) ON DELETE SET NULL;
CREATE INDEX idx_surveys_linked ON surveys(linked_voting_survey_id);

-- questions テーブル: email タイプ追加（question_type は VARCHAR なので値追加のみ）
-- 既存: 'single_choice', 'multiple_choice', 'text'
-- 追加: 'email'

-- votes テーブル: voter_token カラム追加
ALTER TABLE votes ADD COLUMN voter_token VARCHAR(64);
CREATE INDEX idx_votes_voter_token ON votes(voter_token);
CREATE UNIQUE INDEX idx_votes_unique_voter_question
  ON votes(voter_token, question_id)
  WHERE voter_token IS NOT NULL;
```

### 4.2 APIエンドポイント

#### 新規: POST /api/v1/votes/batch（認証投票用）
```
Request:  { voter_token: string, answers: [{ question_id, option_id?, answer_text? }] }
Response: { message: "投票が完了しました", votes: [{ id, question_id, voted_at }] }

Flow:
1. Zod バリデーション
2. VoterModel.findByToken(voter_token) → voter取得
3. voter.status チェック（'voted' なら 403）
4. SurveyModel.findById(voter.survey_id) → survey取得 + isPublished チェック
5. 全question_idがsurveyに属するか検証 + option_id所属チェック
6. BEGIN TRANSACTION
   6a. SELECT * FROM voters WHERE voter_token = $1 FOR UPDATE（行ロック）
   6b. VoteModel.createBatch(client, voteInputs)
   6c. UPDATE voters SET status='voted' WHERE voter_token=$1 AND status IN ('sent','registered')
   6d. COMMIT (失敗時 ROLLBACK)
7. Redis キャッシュ無効化 + Socket.IO ブロードキャスト
```

#### 新規: POST /api/v1/votes/register（登録アンケート回答用）
```
Request:  { survey_token: string, answers: [{ question_id, option_id?, answer_text? }] }
Response: { message: "登録が完了しました。投票リンクは後日メールでお届けします。" }

Flow:
1. survey_tokenからsurvey取得
2. linked_voting_survey_id が存在するか確認（なければ400）
3. email質問を特定し、メールアドレスを抽出
4. 重複チェック: voters テーブルに同じemail + 投票survey_id の組み合わせがないか
5. BEGIN TRANSACTION
   5a. 全回答をvotesテーブルにINSERT（登録survey_id + session_idにvoter_token）
   5b. votersテーブルにINSERT（投票survey_id, email, voter_token, status='registered'）
   5c. COMMIT
6. 登録完了レスポンス
```

#### 改修: GET /api/v1/voters/verify/:voter_token
```
変更点:
- survey.token (unique_token) をレスポンスに追加
- voter.voter_token をエコーバック
- レート制限を追加
```

#### 改修: POST /api/v1/votes（既存の匿名投票）
```
変更点:
- require_registration=true のsurveyへの匿名投票を403ブロック
- Zodバリデーション追加
- voteRateLimit ミドルウェア適用
- option_id → question_id 所属チェック追加
```

### 4.3 フロントエンド

#### /register/[survey_token] → 登録アンケートページ（再設計）
- 従来: メール入力のみの簡易フォーム
- 変更後: 完全なアンケートフォーム（投票ページと同等のUI）
- email質問タイプの専用レンダリング（input type="email" + バリデーション）
- 送信先: POST /api/v1/votes/register

#### /vote/auth/[voter_token] → 認証投票ページ（バグ修正）
- 送信先を POST /api/v1/votes/batch に変更
- multiple_choice のチェックボックスUI修正
- エラーハンドリング改善（403/404の区別）

#### /admin/surveys/new + /admin/surveys/[id] → アンケート作成・編集（改修）
- 「登録用アンケートとして設定」UIの追加
- 投票用アンケートの選択ドロップダウン（linked_voting_survey_id）
- email質問タイプの追加

#### /admin/surveys/[id]/voters → 投票者管理（改修）
- 登録アンケートの回答データ表示

---

## 5. Task Breakdown

| # | タスク | 依存 | 推定 | 概要 |
|---|--------|------|------|------|
| 01 | DBマイグレーション | なし | 1h | surveys.linked_voting_survey_id, votes.voter_token, email question_type |
| 02 | Surveyモデル更新 | 01 | 1h | linking CRUD、findRegistrationSurveys、validation |
| 03 | VoteModel更新 | 01 | 1h | createBatch改善、hasVotedByToken、voter_token対応 |
| 04 | 登録アンケート回答API | 01,02,03 | 2h | POST /votes/register（回答保存+voter作成、トランザクション） |
| 05 | バッチ投票API | 01,03 | 2h | POST /votes/batch（FOR UPDATE、トランザクション、ブロードキャスト） |
| 06 | 既存API修正 | 01 | 1.5h | POST /votes ガード、GET /verify レスポンス改善、Zod追加 |
| 07 | セキュリティ修正 | 06 | 1h | レート制限適用、option_id検証、エラーメッセージ修正、CSRF改善 |
| 08 | フロント: 登録ページ再設計 | 04 | 2h | /register/[survey_token] を完全アンケートフォームに |
| 09 | フロント: 認証投票ページ修正 | 05 | 1.5h | /vote/auth/[voter_token] バッチ送信、multiple_choice修正 |
| 10 | フロント: 管理画面改修 | 02 | 2h | アンケート作成/編集にリンクUI、email質問タイプ追加 |
| 11 | フロント: 投票者管理改修 | 04 | 1h | 登録アンケート回答の表示 |
| 12 | E2Eテスト・デプロイ | 全タスク | 2h | 登録→メール→投票の一連フローテスト |

**合計: 約18時間（3日）**

---

## 6. Design Decisions

### DD-1: バッチ投票を新エンドポイントに分離
- **選択**: POST /votes/batch を新設（既存の POST /votes は匿名用のまま維持）
- **理由**: 匿名フロー（1問ずつ送信）と認証フロー（全問一括送信）はセマンティクスが根本的に異なる。同一ハンドラに2つの制御フローを混在させるとテスト・保守が困難
- **トレードオフ**: エンドポイントが2つになるが、関心の分離が明確

### DD-2: 登録回答をvotesテーブルに保存
- **選択**: 登録アンケートの回答も votes テーブルに INSERT
- **理由**: 登録フォームが「本物のアンケート」である以上、回答は同じスキーマで管理すべき。analytics機能もそのまま使える
- **トレードオフ**: voters.registration_data（JSONB）は不要になるが、既存データの移行は行わない

### DD-3: voter_token を votes テーブルに追加
- **選択**: votes.voter_token カラム追加 + 部分UNIQUE INDEX
- **理由**: 認証投票の重複チェックをDB制約レベルで保証。session_idベースのチェックは匿名投票専用に
- **トレードオフ**: スキーマ変更が必要だが、匿名投票（voter_token=NULL）には影響なし

### DD-4: survey_type カラムは追加しない
- **選択**: `linked_voting_survey_id` の有無で登録用/投票用を判定
- **理由**: 最小限のスキーマ変更。新しいENUM型を追加するよりシンプル

---

## 7. Out of Scope

- 投票結果の公開ページ（管理者のみ閲覧）
- 複数回投票の許可モード
- 投票の取り消し・変更機能
- voters.registration_data の votes テーブルへの移行
- Redis セッション管理の変更

---

## 8. Success Criteria

1. 管理者が「登録用アンケート」を作成し、投票用アンケートにリンクできる
2. 投票者が登録用アンケートに回答すると、voter_tokenが生成される
3. 管理者が投票リンクを一括送信できる
4. 投票者がメールのリンクから全問一括で投票できる
5. 同一メールでの二重登録が防止される
6. 同一voter_tokenでの二重投票が防止される（DB制約 + トランザクション）
7. 既存の匿名投票フローが壊れない
8. レースコンディションが発生しない（SELECT FOR UPDATE）
