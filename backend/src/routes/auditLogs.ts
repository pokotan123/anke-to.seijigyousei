import express from 'express';
import { AuthRequest } from '../middleware/auth';
import { AuditLogService, AuditLogFilter, escapeCsvCell } from '../services/auditLog';

const router = express.Router();
// authenticateToken + requireAdmin は index.ts で attach（設計書 §8.1 一本化ルール）

function parseFilter(q: Record<string, unknown>): AuditLogFilter {
  const filter: AuditLogFilter = {};
  if (typeof q.admin_id === 'string') {
    const n = Number(q.admin_id);
    if (Number.isFinite(n)) filter.admin_id = n;
  }
  if (typeof q.action === 'string') filter.action = q.action;
  if (typeof q.resource_type === 'string') filter.resource_type = q.resource_type;
  if (typeof q.resource_id === 'string') filter.resource_id = q.resource_id;
  if (typeof q.from_date === 'string') filter.from_date = q.from_date;
  if (typeof q.to_date === 'string') filter.to_date = q.to_date;
  return filter;
}

function periodDays(from: string, to: string): number {
  const f = new Date(from).getTime();
  const t = new Date(to).getTime();
  if (Number.isNaN(f) || Number.isNaN(t)) return Infinity;
  return Math.ceil((t - f) / (1000 * 60 * 60 * 24));
}

// 監査ログ閲覧（list 自身は記録しない: 設計書 §7.1）
router.get('/', async (req: AuthRequest, res) => {
  // list 自身は監査対象外: middleware の skip フラグを立てる
  res.locals.audit = { ...(res.locals.audit ?? {}), skip: true };

  try {
    const filter = parseFilter(req.query as Record<string, unknown>);
    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;

    const result = await AuditLogService.list(filter, limit, offset);
    res.json({
      rows: result.rows,
      total: result.total,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('List audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// CSV出力（記録対象: action=EXPORT, resource_type=audit_log, details.export_row_count）
router.get('/export/csv', async (req: AuthRequest, res) => {
  try {
    const filter = parseFilter(req.query as Record<string, unknown>);

    // 期間必須
    if (!filter.from_date || !filter.to_date) {
      res.status(400).json({ error: 'from_date and to_date are required' });
      return;
    }

    // 期間最大366日
    const days = periodDays(filter.from_date, filter.to_date);
    if (days > 366) {
      res.status(400).json({ error: 'period exceeds 366 days; please split exports' });
      return;
    }

    // 件数上限チェック
    const totalCount = await AuditLogService.countInRange(filter.from_date, filter.to_date);
    if (totalCount > 100000) {
      res.status(400).json({ error: `result exceeds 100000 rows (${totalCount}); please narrow the period` });
      return;
    }

    // フル取得（最大100000）
    const result = await AuditLogService.list(filter, 100000, 0);

    // CSV ヘッダ
    const headers = [
      'ID', '日時', '管理者ID(snapshot)', '管理者ID(FK)', '管理者名',
      '操作', 'リソース種別', 'リソースID',
      'メソッド', 'エンドポイント', 'ルートパターン', 'ステータス',
      'IP', 'User-Agent', '詳細(JSON)',
    ];
    const rows = result.rows.map((r) => [
      r.id, r.created_at, r.admin_id_snapshot, r.admin_id ?? '', r.admin_username ?? '',
      r.action, r.resource_type ?? '', r.resource_id ?? '',
      r.http_method ?? '', r.endpoint ?? '', r.route_pattern ?? '', r.status_code ?? '',
      r.ip_address ?? '', r.user_agent ?? '', r.details ? JSON.stringify(r.details) : '',
    ]);

    const csv = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ].join('\n');

    // 自身のEXPORT記録（res.locals 経由で middleware に伝える）
    res.locals.audit = {
      ...(res.locals.audit ?? {}),
      action: 'EXPORT',
      resource_type: 'audit_log',
      details: {
        export_row_count: result.rows.length,
        filter_summary: {
          from_date: filter.from_date,
          to_date: filter.to_date,
          ...(filter.admin_id ? { admin_id: String(filter.admin_id) } : {}),
          ...(filter.action ? { action: filter.action } : {}),
          ...(filter.resource_type ? { resource_type: filter.resource_type } : {}),
        },
      },
    };

    const bom = '﻿';
    const filename = `audit-logs_${filter.from_date}_${filter.to_date}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(bom + csv);
  } catch (error: any) {
    console.error('Export audit logs CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
