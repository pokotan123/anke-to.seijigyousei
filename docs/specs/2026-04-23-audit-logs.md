# 設計書: admin_id 付きアクセスログ機構

- **作成日**: 2026-04-23
- **担当**: architect (quality-dev)
- **ブランチ**: `feature/audit-logs`
- **ステータス**: Phase 1 設計レビュー完了（v2: 4系統レビュー指摘反映済）
- **バージョン**: v2.3 (2026-04-23) — 第3周レビュー（Codex E1-E8）反映

---

## 1. 目的・背景

### 1.1 背景
東京青年会議所（東京JC）と本サービスの間で締結する「個人情報取扱覚書 v3」第6条3項により、個人情報を取り扱う管理者操作のアクセスログ記録が要求される。

該当条文（要旨）:
> 受託者は、個人情報にアクセスした管理者の識別情報（admin_id）と操作内容を合理的な範囲で記録する。

### 1.2 目的
本アンケートシステムの管理API（`/api/v1/*`配下、認証必須エンドポイント）に対し、以下を実現する:

1. **誰が（admin_id / admin_username）**
2. **いつ（created_at）**
3. **どこから（ip_address / user_agent）**
4. **何を（action / resource_type / resource_id / endpoint）**
5. **どうなったか（status_code）**

を改ざん困難な形で永続記録する。

### 1.3 非目標（YAGNI）
以下は今回の対象外とする:
- UPDATE/DELETE時の変更前後の差分記録（運用承認: 案I = 操作事実のみ）
- リアルタイムアラート / SIEM連携
- ログ署名・WORM（Write Once Read Many）ストレージ
- 監査ログ自体の改ざん検知（ハッシュチェーン等）

---

## 2. ユーザー承認済み判断（Phase 1事前承認）

| # | 論点 | 採用案 |
|---|------|--------|
| (a) | ログ対象範囲 | **A: 全管理API（CRUD+閲覧）すべて** |
| (b) | 閲覧UI | **2: フロント管理画面に「監査ログ」タブ追加** |
| (c) | 記録粒度 | **I: 操作事実のみ（差分なし）** |
| (d) | 保持期間 | **Y: 環境変数 `AUDIT_LOG_RETENTION_DAYS`**（v2.1 改訂: デフォルト 365日 = 1年。詳細 §9.1） |

---

## 3. アーキテクチャ概要

```
┌─────────────────┐
│ Admin Browser   │
└────────┬────────┘
         │ JWT + Request
         ▼
┌─────────────────────────────────────────────┐
│ Express App                                 │
│  ├ helmet / cors / rateLimit                │
│  ├ authenticateToken  ──→ req.user 付与     │
│  ├ auditLogMiddleware ◀── 本実装で追加      │
│  │   └ res.on('finish') で非同期書き込み    │
│  └ Routes (surveys/voters/votes/...)        │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
        ┌──────────────────┐
        │ AuditLogService  │
        │  .log()          │  fire-and-forget
        │  .list()         │
        │  .pruneOlderThan │
        └────────┬─────────┘
                 │
                 ▼
         ┌────────────────┐
         │ PostgreSQL     │
         │  audit_logs    │  BIGSERIAL / JSONB
         └────────────────┘
```

---

## 4. DB スキーマ設計（v2 改訂版 — 4系統レビュー指摘反映）

### 4.1 テーブル定義

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- admin_id_snapshot: admin削除後も「誰が」を保証する非NULL識別子（Codex Critical対応）
    admin_id_snapshot INTEGER NOT NULL,
    admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL, -- 参照整合性用（FKは残すが識別性は snapshot に依存）
    admin_username VARCHAR(100),     -- admin削除後の人間可読識別子
    action VARCHAR(50) NOT NULL,     -- 値域は §5.3 の語彙表を参照
    resource_type VARCHAR(50),       -- 値域は §5.4 の語彙表を参照
    resource_id VARCHAR(100),        -- 単数IDのみ。複数対象は details.target_ids に格納（Codex Critical対応）
    http_method VARCHAR(10) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,  -- 実パス（PII含む可能性あり、§5.1 の制約を参照）
    route_pattern VARCHAR(255),      -- Express の `req.route.path`（例: /api/v1/surveys/:id）
    status_code INTEGER NOT NULL,
    ip_address VARCHAR(45),          -- IPv4/IPv6 両対応、trust proxy 経由（§5.1）
    user_agent VARCHAR(500),         -- 500超は末尾省略（§6.2）
    details JSONB,                   -- スキーマ固定キー。§4.4 を参照
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()  -- TZ付き（Codex/Gemini Important対応）
);

-- 主要クエリ「最近順 + admin絞り込み」用の複合インデックス
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at         ON audit_logs(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_created      ON audit_logs(admin_id_snapshot, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created     ON audit_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_created   ON audit_logs(resource_type, resource_id, created_at DESC);
```

### 4.2 設計判断（v2）

| 項目 | 決定 | 根拠 |
|------|------|------|
| `id` 型 | BIGINT GENERATED ALWAYS AS IDENTITY | 現行PG推奨（Codex Minor対応）。1年で数万行想定だが将来拡張に備え BIGINT |
| `admin_id_snapshot` | NOT NULL | **admin削除後も「誰が」を保証**（Codex Critical対応）。覚書「管理者の識別情報」要件を満たす |
| `admin_id` (FK) | ON DELETE SET NULL | 参照整合性は SET NULL、識別は snapshot で担保 |
| `admin_username` 非正規化 | あり、CSV injection エスケープ必須（§6.3） | 操作時点のユーザー名追跡 |
| `action` 列挙 | VARCHAR(50) | 値域は §5.3 で固定 |
| `details` 型 | JSONB（キー固定 §4.4） | 自由欄化を防止 |
| 主要 NOT NULL | http_method / endpoint / status_code / created_at / admin_id_snapshot | データ品質保証（Codex Minor対応） |
| インデックス | 4本すべて (col, created_at DESC) 複合 | 主要クエリは「期間 + 絞り込み」（Codex Important対応） |

### 4.3 マイグレーション戦略（v2 改訂）

- **新規環境**: `database/init.sql` に CREATE TABLE 追記（冪等）
- **既存Railway環境**: `connection.ts` の auto-migration ブロック流用は **暫定** とし、将来 ALTER が必要になった時点で **専用 migration ファイル** に切り替える方針を ADR-9 として明記（Codex Important対応）
- 多重起動時の競合防止: CREATE TABLE IF NOT EXISTS は安全。ALTER 系を auto-migration に追加してはならない

### 4.4 `details` JSONB スキーマ（固定キー）

```typescript
type AuditDetails = {
  duration_ms?: number;
  target_ids?: (string | number)[];       // 複数対象操作
  request_id?: string;                     // アプリログとの突合用
  failure_reason?: 'invalid_credentials' | 'user_not_found' | 'disabled' | 'unknown'; // LOGIN_FAILED専用
  export_row_count?: number;               // EXPORT専用
  row_count?: number;                      // prune実行時の削除件数（v2.2 追加 — Codex A4対応）
  dry_run?: boolean;                       // prune --dry-run 実行記録
  filter_summary?: Record<string, string>; // list/exportのフィルタ条件サマリ
  // ⚠️ 個人情報・トークン・パスワードを入れてはならない（§6.4 で強制）
};
```

最大サイズ: アプリ層で 4KB 上限チェック（Gemini/Codex Critical対応 — PII / 巨大データ流入防止）。

---

## 5. ミドルウェア設計（v2 改訂）

### 5.0 前提条件（必須）

- **Express `app.set('trust proxy', 1)` が既に設定済**（Railway環境のためIP正しく取れる）— 既存 `index.ts:23` を確認済（spec-reviewer / Gemini Critical 対応）
- ルート設計を **公開API router と管理API router で物理分離** する（Codex Critical対応）。`votes.ts` / `voters.ts` は内側で `app.use('/admin', ...)` 等で分割

### 5.1 ファイル: `backend/src/middleware/auditLog.ts`

```ts
export function auditLogMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const startedAt = Date.now();
  // request_id 生成 + response header にも返す（X-Request-Id、§5.2 参照）
  const requestId = (req.headers['x-request-id'] as string) ?? crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);
  // ルート側で res.locals.audit を上書きすることで action/resource_type/resource_id を明示制御可能
  res.locals.audit = res.locals.audit ?? {};

  res.on('finish', () => {
    const adminId = req.user?.id ?? null;

    const inferred = inferAction(req.method);
    const inferredResource = inferResource(req.route?.path ?? req.path);
    const override = res.locals.audit ?? {};

    AuditLogService.log({
      admin_id_snapshot: adminId ?? -1,  // 未認証時は -1（センチネル）
      admin_id: adminId,
      admin_username: truncate(req.user?.username ?? null, 100),
      action: override.action ?? inferred,
      resource_type: override.resource_type ?? inferredResource.type,
      resource_id: override.resource_id ?? inferredResource.id,
      http_method: req.method,
      endpoint: truncate(req.originalUrl?.split('?')[0] ?? req.baseUrl + req.path, 500),  // mount prefix を含む完全パス（v2.3 Codex E1 対応）
      route_pattern: (req.baseUrl ?? '') + (req.route?.path ?? ''), // 完全テンプレート（集計用）
      status_code: res.statusCode,
      ip_address: req.ip ?? 'unknown',                      // trust proxy 経由
      user_agent: truncate(req.get('user-agent') ?? null, 500),
      details: {
        ...override.details,
        duration_ms: Date.now() - startedAt,
        request_id: requestId,
      },
    }).catch(err => structuredErrorLog('audit_log_write_failed', { err, route: req.route?.path, status: res.statusCode, admin_id: adminId, request_id: requestId }));
  });
  next();
}
```

### 5.2 設計上の重要点（v2）

| 項目 | 決定 | 根拠 |
|------|------|------|
| 書き込みタイミング | `res.on('finish')` | レスポンス確定後に status_code が決まる |
| エラーハンドリング | fire-and-forget + **構造化エラーログ** + 失敗カウンタ | ログ書き込みでHTTPレスポンスを止めない／欠落検知（Codex Critical対応） |
| 配置位置 | `authenticateToken` の後段 | req.user を参照するため |
| **route metadata override** | `res.locals.audit = { action, resource_type, resource_id, details }` でルート側から上書き可能 | inferAction/Resource の脆弱性を補完（spec/Codex/Gemini対応） |
| **request_id 付与** | middleware 先頭で `req.headers['x-request-id'] ?? crypto.randomUUID()` を生成し `res.setHeader('X-Request-Id', id)` でレスポンスにも返す | アプリログとの突合（Codex Important対応 + v2.3 E6: response header 設定明記） |
| **失敗監視** | log() 失敗時は構造化エラー出力 + Prometheus 互換カウンタ（暫定: stderr 集計） | コンプライアンス駆動なら欠落観測必須（Codex Critical対応） |
| 対象ルート | router 物理分離後、管理 router にのみ attach | 公開/管理混在ルートをまず分離する（Codex Critical対応） |

### 5.3 action推論ロジック

| HTTPメソッド | デフォルト action |
|------------|-----------------|
| GET | READ |
| POST | CREATE（CSV exportは route で `EXPORT` 上書き） |
| PUT/PATCH | UPDATE |
| DELETE | DELETE |

ログイン/ログアウトは `routes/auth.ts` 側で明示的に `LOGIN` / `LOGIN_FAILED` を `AuditLogService.log()` で直接記録。

### 5.4 resource推論ロジック
URLパス先頭セグメント（`/api/v1/surveys/123` → `survey:123`）から導出。

---

## 6. サービス層設計

### 6.1 ファイル: `backend/src/services/auditLog.ts`

公開API:

```ts
AuditLogService = {
  log(entry: AuditLogEntry): Promise<void>;        // fire-and-forget前提、内部でtry/catch
  list(filter, limit, offset): Promise<ListResult>; // 管理画面/CSV用
  pruneOlderThan(days: number): Promise<number>;   // バッチ削除（戻り値=削除件数）
};
```

### 6.2 設計判断（v2）

| 項目 | 決定 | 根拠 |
|------|------|------|
| log() 失敗時 | 構造化エラー出力（reqId/route/status/admin_id）+ 失敗カウンタ | 欠落調査可能化（Codex Critical対応） |
| list() SQL対策 | フィルタキーをホワイトリスト化 + パラメータ化 | 動的WHERE構築の安全性 |
| LIMIT/OFFSET | アプリ層で `Math.min(1000)` クランプ + 整数化 | DoS防止 |
| **list() ソート** | `ORDER BY created_at DESC, id DESC` 固定 | 安定ページング（Codex Important対応） |
| **list() 期間** | `from_date <= created_at < to_date`（半開区間）+ TZ は UTC | TZ解釈の明確化（Codex Important対応） |
| pruneOlderThan() | NOW() - INTERVAL + 削除前件数ログ + ドライラン引数対応 | 運用の安全性（Codex Important対応） |
| **入力サニタイズ** | admin_username に制御文字除去 + 100文字 truncate + CSV cell先頭 `= + - @` エスケープ | ログインジェクション/CSV injection 対策（Codex Critical対応） |
| **truncate ポリシー** | endpoint=500 / user_agent=500 / admin_username=100 で末尾切り捨て | 保存失敗より縮退保存（Codex Important対応） |

### 6.3 入力サニタイズ実装

```ts
function sanitizeForAuditLog(s: string | null | undefined, maxLen: number): string | null {
  if (s == null) return null;
  // 制御文字除去（タブ・改行は許容しない）
  const cleaned = String(s).replace(/[\x00-\x1F\x7F]/g, '');
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen - 1) + '…' : cleaned;
}

function escapeCsvCell(s: string): string {
  // CSV injection 防止: 先頭が = + - @ の場合は単一引用符でエスケープ
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}
```

### 6.4 PII セーフガード（details 書き込み時）

`AuditLogService.log()` 内で `details` のキーを §4.4 のホワイトリスト型と照合。
許可外キー（`password`, `token`, `email`, `body` 等）が含まれた場合は警告ログを出してその key を除去する。

---

## 7. 閲覧API + 管理画面設計

### 7.1 API: `backend/src/routes/auditLogs.ts`（v2）

| エンドポイント | 認証 | 機能 | 自身の監査ログ記録方針 |
|---------------|------|------|----------------------|
| `GET /api/v1/admin/audit-logs` | admin only | ページング・フィルタ閲覧 | **記録しない**（spec-reviewer Critical対応：自己再帰ループ回避） |
| `GET /api/v1/admin/audit-logs/export/csv` | admin only | CSV出力（覚書提出用） | **記録する**（`resource_type='audit_log', action='EXPORT', details.export_row_count`）|

クエリパラメータ:
- `admin_id`, `action`, `resource_type`, `resource_id`, `from_date`, `to_date`, `limit`, `offset`

CSV出力の制約（v2）:
- `from_date` と `to_date` を **必須化**（無制限エクスポート禁止）
- 期間最大: 366日（1年超は分割出力）
- 最大行数: 100,000 行（超過時 400 エラー）
- セルは §6.3 `escapeCsvCell` でエスケープ（CSV injection 対策）
- BOM付き UTF-8（既存 `surveys.ts` のCSV出力パターンと統一）

### 7.2 フロント管理画面（v2 — plan-design-review 反映）

**新規ページ**: `frontend/app/(admin)/audit-logs/page.tsx`

#### 情報階層
1. ページヘッダ「監査ログ（個人情報取扱覚書 第6条3項対応）」+ 最終操作時刻
2. 期間プリセット + CSVダウンロード（最重要：覚書提出が主目的）
3. 絞り込みフィルタ（管理者 / 操作 / リソース）
4. ページング付きテーブル
5. 詳細モーダル

#### インタラクション状態（5状態すべて定義）

| 機能 | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL |
|------|---------|-------|-------|---------|---------|
| ログ一覧 | スケルトン10行 | 「該当期間の操作ログはありません」+ 期間変更CTA | 「ログ取得に失敗しました」+ 再試行 | 件数 + テーブル | フィルタ更新中はテーブル半透明 |
| CSV出力 | ボタン「出力中...」+ 進捗 | （該当なし） | トースト「CSV出力に失敗」 | ダウンロード + 「出力完了」トースト | （該当なし） |
| 詳細モーダル | スピナー | 「詳細情報なし」 | 「詳細取得失敗」 | JSONB整形表示 | （該当なし） |

#### 期間プリセット（v2.2 — Codex D1 対応）
- 「今四半期」「今年度」「前年度（保持期間内のみ）」「保持中の全期間」+ カスタム日付指定
- 「前年度」プリセット選択時、retention 範囲外の場合は警告: 「保持期間（〜N日）外のデータは表示されません」
- CSV出力時は `from_date`/`to_date` 必須
- 単発イベント運用前提（§9.0）のため、実質「全期間」=「イベント開始からの全期間」となる想定

#### 詳細モーダルでのPIIマスキング
- `details.target_ids` 等の数値ID は表示
- 自由記述系フィールドは「[masked]」表示（運用上はDB直接確認）

#### レスポンシブ
- PC（1024px+）: 全列表示
- タブレット（768~1023px）: 主要列のみ + テーブル横スクロール
- モバイル（~767px）: 「PC推奨」バナー + 操作不可

#### a11y
- キーボード Tab 順: フィルタ → テーブル行 → ページング
- `<table>` に `<caption>` で件数・期間を読み上げ
- ボタン・リンク 44px 以上
- アクション種別カラーは WCAG AA (4.5:1)
- フォーカスインジケータ全要素

**ナビ追加**: 既存のadmin専用サイドバー（既存パターン踏襲）。viewer ロールはサイドバー項目自体を非表示（無駄な誘導をしない）。

### 7.3 アクセス制御
- バックエンド: `authenticateToken` + `requireAdmin` 必須
- フロント: `role === 'admin'` 以外はナビ非表示 + アクセス時リダイレクト
- viewer ロールは閲覧不可（覚書の対象は管理者全般だが、監査ログ自体は admin に限定）

---

## 8. 既存ルートへの組み込み方針（v2 — Codex Critical 反映）

### 8.1 router 物理分離戦略（v2.2 — Codex Critical A1 修正：二重適用回避）

**ルール統一**: middleware は **index.ts での attach 一本化**。router 内部での `router.use(middleware)` は禁止（二重適用回避）。

```ts
// votes.ts / voters.ts の内部リファクタ例（middleware 内蔵しない）
import { Router } from 'express';

export const publicVoterRouter = Router();   // 公開: /vote/submit, /register 等
export const adminVoterRouter  = Router();   // 管理: /list, /export 等
// ⚠️ adminVoterRouter.use(authenticateToken, auditLogMiddleware) は書かない（index.ts で attach）
// adminVoterRouter.get('/list', ...)
// adminVoterRouter.get('/export/csv', ...)
```

### 8.2 index.ts での attach（middleware は1箇所のみ）

```ts
// 公開API（監査対象外、middleware なし）
app.use('/api/v1/votes', publicVotesRouter);
app.use('/api/v1/voters/register', publicVotersRouter);
app.use('/api/v1/surveys/token', publicSurveysRouter);

// 管理API（middleware は index.ts で attach、router 内部では attach しない）
app.use('/api/v1/auth', authRoutes);                              // 内部で LOGIN/LOGIN_FAILED 個別記録
app.use('/api/v1/surveys', authenticateToken, auditLogMiddleware, adminSurveyRoutes);
app.use('/api/v1/questions', authenticateToken, auditLogMiddleware, questionRoutes);
app.use('/api/v1/votes/admin', authenticateToken, auditLogMiddleware, adminVotesRouter);
app.use('/api/v1/voters/admin', authenticateToken, auditLogMiddleware, adminVoterRouter);
app.use('/api/v1/admin/analytics', authenticateToken, auditLogMiddleware, analyticsRoutes);
app.use('/api/v1/admin/audit-logs', authenticateToken, requireAdmin, auditLogRoutes); // 自身は auditLogMiddleware 不要(§7.1)
```

**A1 リグレッション防止**: dev-be の実装時、router 内部に `router.use(auditLogMiddleware)` を書いていないか自動チェック（grep ベース）を実装後の verify ステップに含める。

### 8.2.1 auth ルート全エンドポイントの監査対象（v2.3 Codex E4 対応）

現行 `routes/auth.ts` の全エンドポイント:

| エンドポイント | middleware | 監査記録方針 |
|--------------|-----------|------------|
| `POST /api/v1/auth/login` | なし | ハンドラ内で `LOGIN` / `LOGIN_FAILED` を明示記録 |
| `GET /api/v1/auth/me` | なし | **記録しない**（自身の情報取得は監査対象外。フロントの状態確認用で大量発生するため） |

**将来追加されるエンドポイント**: logout / refresh / password change 等を追加する場合は、本表を更新し `auditLogMiddleware` を attach するか、ハンドラ内で明示記録する方針を決定すること。

### 8.3 ログイン記録（routes/auth.ts）

`POST /api/v1/auth/login` ハンドラ内で（middleware ではなく明示的に呼ぶ）:

| ケース | action | admin_id_snapshot | admin_username | details.failure_reason |
|--------|--------|------------------|----------------|----------------------|
| 成功 | `LOGIN` | admin.id | admin.username | （なし） |
| ユーザー名不一致 | `LOGIN_FAILED` | -1 | sanitize(req.body.username, 100) | `user_not_found` |
| パスワード不一致 | `LOGIN_FAILED` | admin.id | admin.username | `invalid_credentials` |
| 無効ユーザー | `LOGIN_FAILED` | admin.id | admin.username | `disabled` |

`req.body.username` は §6.3 `sanitizeForAuditLog()` で必ずクリーニング（Codex Critical対応）。

---

## 9. 保持期間ポリシー（v2.2 — α採用 + 単発イベント前提明記）

### 9.0 サービス運用モデル（前提 — v2.3 Codex E3 対応：技術ガード追加）

本アンケート・投票システムは **単発イベント単位での利用** を前提とする:
- 1イベント = 1〜数アンケート（数日〜数ヶ月）
- イベント終了後はシステム自体を停止 or 次イベント用に再利用
- **継続的な多年運用は非想定**

このため、以下の運用方針を採用する（α採用）:
- **保持期間1年は形式的（フェイルセーフ）な値**
- 実質は **システム稼働中はログを全保持** → イベント終了時に **一括削除**（DB含めシステム廃棄）
- 月次 prune による年度跨ぎ問題は稼働期間が短いため **実質発生しない**
- 「前年度」プリセットの未保持期間警告は §7.2 で UI レベルで対応

**位置づけ（v2.3 緩和）**:
§9.0 は **A2/B1 を完全に閉じる根拠ではなく、「リスクを下げる運用想定」** として位置づける。
技術的にイベント境界を強制する仕組みは現時点で実装しない（YAGNI）。代わりに以下の運用ガードを設ける:

#### 9.0.1 運用ガード（最低限）
1. **デプロイ単位**: 1 Railway プロジェクト = 1 イベント（再利用しない）
2. **イベント終了時の責任主体**: イベント主管者（プロジェクトオーナー）が DB 廃棄を実施
3. **再利用条件**: 別イベントで流用する場合は事前に `audit_logs` を含む全テーブル truncate（運用手順書に明記）
4. **将来の拡張**: 多年運用に切り替える場合は `event_id` カラム追加 + イベント単位 prune を別途設計（本実装の範囲外）

### 9.1 環境変数設定（フェイルセーフ — v2.3 Codex E2 強化）

```ts
function resolveRetentionDays(): number {
  const raw = process.env.AUDIT_LOG_RETENTION_DAYS;
  const n = Number(raw);
  // 整数 かつ 正数 のみ採用。NaN / 0 / 負数 / 非整数はすべて 365 にフォールバック
  if (Number.isInteger(n) && n > 0) return n;
  if (raw !== undefined) console.warn(`[audit] invalid AUDIT_LOG_RETENTION_DAYS=${raw}, using default 365`);
  return 365;
}
const RETENTION_DAYS = resolveRetentionDays();
```

**負数ガード**: 負数 retention は `pruneOlderThan()` の SQL `INTERVAL` で意図しない結果を生むため明示拒否。

- デフォルト: **365日**（イベント長期化時の保険）
- 短期イベントなら環境変数未設定で運用可
- 長期化 or 多年運用に切替時は環境変数で延長可能

### 9.1.1 覚書 v3 第5条「秘密保持 終了後2年」との関係

**両者は独立した数値として扱う**（v2.2 文言緩和 — Codex A3対応）:

| 項目 | 期間 | 根拠 | 性質 |
|------|------|------|------|
| 覚書 v3 第5条 秘密保持義務 | 契約終了後 **2年** | 契約上の秘密情報を漏洩しない義務の存続期間 | **義務の期間** |
| 監査ログ（audit_logs）保管期間 | **1年**（環境変数で変更可） | アクセス追跡のための運用上の保管期間 | **データの保管期間** |

**概念整理**: 秘密保持義務（=「秘密情報を漏らさない」というアクション制約）と、アクセスログ保管（=「過去の操作を再確認できるようにする」というデータ可用性）は別の概念。

**覚書本文からは「2年保存義務」は直ちには導けない**。第6条3項も「合理的な範囲で記録」と規定するのみ。
ただし、1年保存で提出・調査実務が満たせるかは契約/運用責任者の判断対象であり、設計上は環境変数で延長可能な構造としている。

**法務確認の扱い**（v2.3 Codex E5 文言緩和）:
- 設計判断としては「本設計の前提外」であり、契約/運用責任者の判断事項とする
- ユーザー判断（単発イベント前提）に基づき、設計レベルでは法務確認を実装ブロックとしない
- 多年運用に切り替える場合は運用責任者が法務再確認を行う

### 9.2 削除スクリプト + 運用設計
- `package.json`: `"prune-audit-logs": "tsx src/database/prune-audit-logs.ts"`
- オプション:
  - `--dry-run`: 削除候補件数のみ表示（必須）
  - `--retention-days N`: 環境変数の上書き
- 実行責任主体: **手動実行 or Railway cron**（単発イベント前提のため自動化は任意）
- 失敗時通知: stderr → Railway logs
- 削除実行ログ自体も `audit_logs` に記録（`action='DELETE', resource_type='audit_log', details.row_count`）— `row_count` は §4.4 ホワイトリストに追加済（A4対応）
- **イベント終了時の最終運用**: prune に頼らず DB ごと一括破棄を推奨（§9.0 の運用モデルに整合）

---

## 10. 却下した代替案（ADR）

| # | 代替案 | 却下理由 |
|---|--------|---------|
| ADR-1 | UPDATE/DELETE時の変更前後の差分記録（before/after JSONB） | ユーザー判断 (c) で「事実記録のみ (案I)」採択。覚書第6条3項は事実記録で十分と解釈。差分取得は全Repository層を改修する必要があり実装複雑度が跳ね上がる |
| ADR-2 | 別DBインスタンスに分離（PostgreSQL audit_db） | Railway構成変更コストが高い。アプリと同DBで JSONB JOIN 不要なため十分。将来必要になったら切り出せる |
| ADR-3 | S3 / Cloudflare R2 への append-only アーカイブ | 覚書要件は「合理的な範囲で記録」。WORM要件はないため過剰設計（YAGNI） |
| ADR-4 | ENUM型で action 制約 | PostgreSQL ENUM は列追加にALTER TYPEが必要で柔軟性低い。VARCHAR + アプリ層型ガードで十分 |
| ADR-5 | リクエストボディ全文を details に記録 | 個人情報の二重保管リスク。GDPR/個人情報保護法的に望ましくない。サマリ情報のみJSONB記録 |
| ADR-6 | Express middleware ではなく PostgreSQL トリガーで全テーブル監視 | アプリ層の admin_id を取得できない（DB側にはJWTコンテキストがない）。SET LOCALで渡す方法もあるが複雑 |
| ADR-7 | パーティション（月次 RANGE PARTITION） | 想定行数（年10万行程度）ではオーバーキル。インデックスとprune運用で十分 |
| ADR-8 | リアルタイム監査ストリーム（Kafka / Redis Stream） | 内部監査ツールでない。バッチ閲覧で要件満たす |
| ADR-9 | auto-migration ではなく専用 migration ファイル方式 | Codex Important対応：将来 ALTER 追加時に多重起動環境で破綻するため、本実装では auto-migration 暫定使用 + ADR で「ALTER は専用migrationに切り出す」を明文化 |
| ADR-10 | INSERT専用ロール分離 / WORM ストレージ | Codex Critical対応として検討したが、Railway PostgreSQL ではロール分離コストが高い。代替として「監査ログ閲覧APIに更新系を持たない」「運用手順でDB直接UPDATE/DELETE禁止」「pruneのみアプリ経由」で擬似 WORM を実現 |
| ADR-11 | viewer ロールの監査ログアクセス | 内部統制の最小権限原則。監査機能は admin 権限者のみが行う運用前提 |

---

## 11. 影響範囲

### 11.1 新規ファイル
- `database/init.sql`（既存追記）
- `backend/src/database/connection.ts`（既存追記、auto-migration）
- `backend/src/middleware/auditLog.ts`（新規）
- `backend/src/services/auditLog.ts`（新規）
- `backend/src/routes/auditLogs.ts`（新規）
- `backend/src/database/prune-audit-logs.ts`（新規）
- `backend/package.json`（npm script追加）
- `backend/src/index.ts`（middleware組み込み）
- `frontend/app/(admin)/audit-logs/page.tsx`（新規UI）
- `frontend/components/admin/Sidebar.tsx` 等（ナビ追加）

### 11.2 既存変更
- `backend/src/index.ts`: ルート attach 順序の変更
- `backend/src/routes/auth.ts`: LOGIN / LOGIN_FAILED の明示記録
- `backend/src/routes/votes.ts`, `voters.ts`: 公開/管理 router を内部で分離（middleware は §8.1 ルールに従い router 内では attach せず、index.ts で一括 attach）

### 11.3 リスク
- **書き込み量増加**: 1リクエスト = 1 INSERT。負荷テスト未実施だが想定（数十req/min）では問題なし
- **既存DB互換性**: CREATE TABLE IF NOT EXISTS で安全
- **個人情報二重化**: detailsには本文を入れない方針で抑制

---

## 12. 実装フェーズ計画（参考、Phase 3 で詳細化）

1. T1: スキーマ追加（init.sql + connection.ts）✅ WIP済
2. T2: AuditLogService 実装（services/auditLog.ts）✅ WIP済
3. T3: middleware/auditLog.ts 実装
4. T4: routes/auditLogs.ts 実装
5. T5: index.ts ルート attach + auth.ts LOGIN記録
6. T6: prune-audit-logs.ts + package.json
7. T7: フロント監査ログページ
8. T8: フロントナビ追加 + 権限ガード
9. T9: 動作確認 / Impact Analysis / 並列レビュー / PR

---

## 13. レビュー履歴 — 4系統独立レビュー結果

### 13.1 各レビュアーのVerdict

| レビュアー | モデル系統 | Critical件数 | Important件数 | Verdict |
|-----------|-----------|-------------|--------------|---------|
| spec-reviewer | Claude (Anthropic) | 3 | 7 | APPROVE_WITH_CHANGES |
| /codex | OpenAI GPT | 6 | 14 | APPROVE_WITH_CHANGES |
| Gemini CLI | Google Gemini | 3 | 3 | APPROVE_WITH_CHANGES |
| /plan-design-review | UI多視点（自己実施） | UI 6項目すべて | — | APPROVE_WITH_CHANGES |

### 13.2 主要指摘の比較表（Critical 中心）

| # | 指摘内容 | spec-reviewer | Codex | Gemini | UI Review | 採用判断 | 反映先 |
|---|---------|--------------|-------|--------|----------|---------|--------|
| C1 | trust proxy 設定明記必須 | ✅ | — | ✅ | — | **採用** — index.ts L23 で確認済 | §5.0 |
| C2 | 監査ログ自身の閲覧でREADログ無限増殖 | ✅ | — | — | — | **採用** — list は記録せず EXPORT のみ | §7.1 |
| C3 | auth ルートの middleware attach 戦略曖昧 | ✅ | ✅ | — | — | **採用** — router 物理分離 + auth.ts 内で個別 LOGIN 記録 | §8.1, §8.3 |
| C4 | admin_id ON DELETE SET NULL は要件と矛盾 | — | ✅ | — | — | **採用** — admin_id_snapshot NOT NULL を追加 | §4.1 |
| C5 | 改ざん耐性が「同一DB通常書き込み」で弱い | — | ✅ | — | — | **部分採用** — INSERT 専用ロール分離はコスト高で却下、運用ルールで擬似WORM（ADR-10） | §10 ADR-10 |
| C6 | fire-and-forget 失敗の欠落検知無し | — | ✅ | ✅(部分) | — | **採用** — 構造化エラーログ + 失敗カウンタ | §5.2, §6.2 |
| C7 | 公開/管理 router 物理分離が必要 | — | ✅ | — | — | **採用** — votes/voters を内部分割 | §8.1 |
| C8 | LOGIN_FAILED の username 未サニタイズ→ログインジェクション/CSV injection | — | ✅ | — | — | **採用** — sanitizeForAuditLog + escapeCsvCell | §6.3, §8.3 |
| C9 | resource_id の「カンマ区切り or JSONB」は破綻 | — | ✅(Critical) | — | — | **採用** — 単数IDのみ、複数は details.target_ids | §4.1 |
| C10 | DB接続プール枯渇リスク | — | — | ✅ | — | **部分採用** — プール上限 + 失敗カウンタで監視。専用プール分離は YAGNI | §6.2 |
| C11 | details に PII 混入リスク（要サニタイズ） | — | — | ✅ | — | **採用** — §4.4 でキー固定、§6.4 で許可外キー除去 | §4.4, §6.4 |
| UI1 | インタラクション5状態未定義 | — | — | — | ✅ | **採用** — 5状態を表で定義 | §7.2 |
| UI2 | レスポンシブ・a11y 仕様ゼロ | — | — | — | ✅ | **採用** — PC/タブレット/モバイル + a11y要件追記 | §7.2 |

### 13.3 Important指摘の主要対応

| 指摘 | レビュアー | 採用判断 | 反映先 |
|------|----------|---------|--------|
| TIMESTAMPTZ 推奨 | Codex / Gemini | **採用** | §4.1 |
| route_pattern と endpoint 分離 | spec-reviewer / Codex | **採用** | §4.1, §5.1 |
| res.locals 経由の action override | spec-reviewer / Codex / Gemini | **採用** | §5.1, §5.2 |
| (created_at, id) 複合 + (admin_id, created_at) 複合 INDEX | Codex | **採用** | §4.1 |
| auto-migration → 将来の専用migration切替 | Codex | **採用** | §4.3, ADR-9 |
| prune 自動化（cron） | spec-reviewer / Codex / Gemini | **方針変更** — 単発イベント前提（§9.0）のため自動化は任意。手動実行 or Railway cron どちらでも可 | §9.2 |
| CSV export 期間必須・件数上限 | spec-reviewer / Codex | **採用** | §7.1 |
| LOGIN_FAILED の failure_reason 区別 | Codex | **採用** | §4.4, §8.3 |
| 構造化エラーログ + request_id | Codex | **採用** | §5.1, §5.2 |
| truncate ポリシー明示 | Codex | **採用** | §6.2, §6.3 |
| 法務確認（保持期間と覚書5条の関係） | Codex | **独立TODO** — 運用しながら必要に応じ法務再確認。実装ブロックではない（ユーザー判断: §9.1.1） | §9.1.1 |

### 13.4 不採用 / 部分採用の理由

| 指摘 | レビュアー | 判断 | 理由 |
|------|----------|------|------|
| INSERT専用ロール分離 / WORM | Codex | 部分採用 | Railway PostgreSQL ではロール運用コストが高い。運用ルールで擬似WORMに代替（ADR-10） |
| 専用 prune 接続プール分離 | Gemini | 不採用 | YAGNI。月次バッチ実行のため通常プールで十分 |
| http_method を TEXT に | Codex | 不採用 | VARCHAR(10) で十分（HTTP標準メソッド最長は OPTIONS = 7文字） |
| 監査ログ自体に GIN INDEX (details JSONB) | Codex | 不採用 | キー固定（§4.4）のため検索パターンが限定。INDEX 不要 |

### 13.5 4系統レビューの一致率

- **3系統以上が一致した指摘**: trust proxy / fire-and-forget 監視 / prune 自動化 / route metadata override
  → コアの設計欠陥として最優先反映（v2 で全採用）
- **Codex のみが指摘した深い設計批判**: admin_id snapshot / WORM / router 分離 / CSV injection
  → Codex の "200 IQ adversarial" 性能が発揮された領域。重大なものは全採用
- **Gemini のみが指摘**: DB接続プール枯渇（運用面の現実的視点）→ 監視強化で対応
- **Claude(spec-reviewer)のみが指摘**: 監査ログ自己再帰ループ（既存実装との整合性視点）
- **UI Review のみが指摘**: フロント仕様の網羅性（バックエンド中心レビュアー陣の盲点を補完）

---

## 14. 設計書 v2 確定状態

- 全 Critical 指摘: 11/11 を採用または部分採用
- Important 指摘: 主要11項目を反映、残りは実装時の指針として記載
- Minor 指摘: 実装時に dev-be が個別判断
- 未解決事項: なし（法務確認は §9.1.1 で「本設計の前提外・運用責任者判断」として整理済み）

**Verdict（4系統統合）**: APPROVE_WITH_CHANGES → v2 反映完了 → 実装着手承認待ち
