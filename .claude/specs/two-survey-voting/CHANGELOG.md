# CHANGELOG: Two-Survey Voting

## 2025-02-25: Task 01-11 実装完了

### 実装内容
- Task 01: DBマイグレーション (002_two_survey_model.sql + init.sql更新)
- Task 02: SurveyModel更新 (linked_voting_survey_id CRUD + findRegistrationSurveys)
- Task 03: VoteModel更新 (voter_token対応、createBatch改善、hasVotedByToken)
- Task 04: POST /voters/register 再設計 (フルアンケート回答 + voter作成トランザクション)
- Task 05: POST /votes/batch 分離 (SELECT FOR UPDATE、option_id検証、voter_token追加)
- Task 06: GET /verify 修正 (survey.unique_token、voter_tokenエコーバック)
- Task 07: セキュリティ修正 (voteRateLimit有効化、CSRF改善、エラーメッセージ修正)
- Task 08: /register/[survey_token] 完全アンケートフォームに再設計
- Task 09: /vote/auth/[voter_token] batch API対応
- Task 10: 管理画面にlinked_voting_survey_id UI + email質問タイプ追加
- Task 11: 投票者管理にlinked_voting_survey_id表示

### ビルド結果
- Backend: TypeScript ゼロエラー
- Frontend: Next.js ビルド成功

### 残り
- Task 12: 本番DBマイグレーション + デプロイ + E2Eテスト

---

## 2025-02-25: PRD作成・タスク分解完了

### 意思決定
- **DD-1**: バッチ投票を新エンドポイント POST /votes/batch に分離（既存匿名フローとの関心分離）
- **DD-2**: 登録アンケートの回答もvotesテーブルに保存（analytics再利用）
- **DD-3**: votes.voter_tokenカラム追加 + 部分ユニークINDEX（DB制約で1人1票保証）
- **DD-4**: survey_typeカラムは追加せず、linked_voting_survey_idの有無で登録/投票を判定

### 背景
- 5エージェント調査で4つの重大バグ + 13のセキュリティ問題を検出
- ユーザー確認: 登録フォーム = 本物のsurvey（質問・選択肢を自由設定可能）
- ユーザー確認: 1人1回しか投票できない（1メール = 1トークン = 1票）

### タスク構成
- 全12タスク、推定18時間（3日）
- Phase 1: DB + モデル (Task 01-03)
- Phase 2: API (Task 04-07)
- Phase 3: フロントエンド (Task 08-11)
- Phase 4: E2E + デプロイ (Task 12)
