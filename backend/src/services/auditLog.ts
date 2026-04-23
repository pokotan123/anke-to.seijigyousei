import { pool } from '../database/connection';

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'CREATE'
  | 'READ'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPORT';

export type AuditResourceType =
  | 'survey'
  | 'question'
  | 'option'
  | 'vote'
  | 'voter'
  | 'admin'
  | 'audit_log'
  | 'analytics';

export interface AuditDetails {
  duration_ms?: number;
  target_ids?: (string | number)[];
  request_id?: string;
  failure_reason?: 'invalid_credentials' | 'user_not_found' | 'disabled' | 'unknown';
  export_row_count?: number;
  row_count?: number;
  dry_run?: boolean;
  filter_summary?: Record<string, string>;
}

export interface AuditLogEntry {
  admin_id_snapshot: number;
  admin_id?: number | null;
  admin_username?: string | null;
  action: AuditAction | string;
  resource_type?: AuditResourceType | string | null;
  resource_id?: string | null;
  http_method?: string | null;
  endpoint?: string | null;
  route_pattern?: string | null;
  status_code?: number | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details?: AuditDetails | Record<string, unknown> | null;
}

export interface AuditLogRow {
  id: number;
  admin_id_snapshot: number;
  admin_id: number | null;
  admin_username: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  http_method: string | null;
  endpoint: string | null;
  route_pattern: string | null;
  status_code: number | null;
  ip_address: string | null;
  user_agent: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogFilter {
  admin_id?: number;
  action?: string;
  resource_type?: string;
  resource_id?: string;
  from_date?: string;
  to_date?: string;
}

export interface ListResult {
  rows: AuditLogRow[];
  total: number;
}

const ALLOWED_FILTER_KEYS: ReadonlyArray<keyof AuditLogFilter> = [
  'admin_id',
  'action',
  'resource_type',
  'resource_id',
  'from_date',
  'to_date',
];

const ALLOWED_DETAIL_KEYS: ReadonlySet<string> = new Set([
  'duration_ms',
  'target_ids',
  'request_id',
  'failure_reason',
  'export_row_count',
  'row_count',
  'dry_run',
  'filter_summary',
]);

const MAX_DETAILS_BYTES = 4096;

export function sanitizeForAuditLog(s: string | null | undefined, maxLen: number): string | null {
  if (s == null) return null;
  const cleaned = String(s).replace(/[\x00-\x1F\x7F]/g, '');
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen - 1) + '…' : cleaned;
}

export function escapeCsvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  const needsCsvEscape = /^[=+\-@]/.test(s);
  const prefixed = needsCsvEscape ? `'${s}` : s;
  if (prefixed.includes(',') || prefixed.includes('"') || prefixed.includes('\n')) {
    return `"${prefixed.replace(/"/g, '""')}"`;
  }
  return prefixed;
}

export function resolveRetentionDays(): number {
  const raw = process.env.AUDIT_LOG_RETENTION_DAYS;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return n;
  if (raw !== undefined) {
    console.warn(`[audit] invalid AUDIT_LOG_RETENTION_DAYS=${raw}, using default 365`);
  }
  return 365;
}

function sanitizeDetails(details: AuditDetails | Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!details) return null;
  const filtered: Record<string, unknown> = {};
  let droppedKeys: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (ALLOWED_DETAIL_KEYS.has(key)) {
      filtered[key] = value;
    } else {
      droppedKeys.push(key);
    }
  }
  if (droppedKeys.length > 0) {
    console.warn(`[audit] dropped non-whitelisted details keys: ${droppedKeys.join(', ')}`);
  }
  const json = JSON.stringify(filtered);
  if (Buffer.byteLength(json, 'utf-8') > MAX_DETAILS_BYTES) {
    console.warn(`[audit] details exceeds ${MAX_DETAILS_BYTES} bytes, dropping`);
    return null;
  }
  return filtered;
}

function buildWhere(filter: AuditLogFilter): { sql: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  for (const key of ALLOWED_FILTER_KEYS) {
    const value = filter[key];
    if (value === undefined || value === null || value === '') continue;

    if (key === 'from_date') {
      params.push(value);
      conditions.push(`created_at >= $${params.length}`);
    } else if (key === 'to_date') {
      params.push(value);
      conditions.push(`created_at < $${params.length}`); // 半開区間
    } else {
      params.push(value);
      conditions.push(`${key} = $${params.length}`);
    }
  }

  return {
    sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

function structuredErrorLog(event: string, ctx: Record<string, unknown>): void {
  console.error(JSON.stringify({ event, ...ctx, ts: new Date().toISOString() }));
}

export const AuditLogService = {
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const cleanDetails = sanitizeDetails(entry.details ?? null);
      await pool.query(
        `INSERT INTO audit_logs (
          admin_id_snapshot, admin_id, admin_username, action, resource_type, resource_id,
          http_method, endpoint, route_pattern, status_code, ip_address, user_agent, details
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          entry.admin_id_snapshot,
          entry.admin_id ?? null,
          sanitizeForAuditLog(entry.admin_username ?? null, 100),
          entry.action,
          entry.resource_type ?? null,
          entry.resource_id ?? null,
          entry.http_method ?? null,
          sanitizeForAuditLog(entry.endpoint ?? null, 500),
          entry.route_pattern ?? null,
          entry.status_code ?? null,
          entry.ip_address ?? null,
          sanitizeForAuditLog(entry.user_agent ?? null, 500),
          cleanDetails ? JSON.stringify(cleanDetails) : null,
        ]
      );
    } catch (error) {
      structuredErrorLog('audit_log_write_failed', {
        err: error instanceof Error ? error.message : String(error),
        admin_id: entry.admin_id,
        endpoint: entry.endpoint,
        status: entry.status_code,
        request_id: (entry.details as AuditDetails | undefined)?.request_id,
      });
    }
  },

  async list(filter: AuditLogFilter, limit = 100, offset = 0): Promise<ListResult> {
    const { sql: whereSql, params } = buildWhere(filter);

    const safeLimit = Math.min(Math.max(parseInt(String(limit), 10) || 100, 1), 1000);
    const safeOffset = Math.max(parseInt(String(offset), 10) || 0, 0);

    const dataQuery = `
      SELECT id, admin_id_snapshot, admin_id, admin_username, action, resource_type, resource_id,
             http_method, endpoint, route_pattern, status_code, ip_address, user_agent, details, created_at
      FROM audit_logs
      ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    const countQuery = `SELECT COUNT(*)::int AS total FROM audit_logs ${whereSql}`;

    const [dataRes, countRes] = await Promise.all([
      pool.query(dataQuery, params),
      pool.query(countQuery, params),
    ]);

    return {
      rows: dataRes.rows as AuditLogRow[],
      total: countRes.rows[0]?.total ?? 0,
    };
  },

  async countInRange(fromDate: string, toDate: string): Promise<number> {
    const res = await pool.query(
      `SELECT COUNT(*)::int AS total FROM audit_logs WHERE created_at >= $1 AND created_at < $2`,
      [fromDate, toDate]
    );
    return res.rows[0]?.total ?? 0;
  },

  async pruneOlderThan(days: number, dryRun = false): Promise<number> {
    if (!Number.isInteger(days) || days <= 0) {
      throw new Error('pruneOlderThan: days must be a positive integer');
    }
    if (dryRun) {
      const res = await pool.query(
        `SELECT COUNT(*)::int AS total FROM audit_logs WHERE created_at < NOW() - ($1 || ' days')::interval`,
        [String(days)]
      );
      return res.rows[0]?.total ?? 0;
    }
    const result = await pool.query(
      `DELETE FROM audit_logs WHERE created_at < NOW() - ($1 || ' days')::interval`,
      [String(days)]
    );
    return result.rowCount ?? 0;
  },
};
