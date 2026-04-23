import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthRequest } from './auth';
import { AuditLogService, AuditDetails, AuditAction, AuditResourceType } from '../services/auditLog';

const RESOURCE_BY_PREFIX: Array<[RegExp, AuditResourceType]> = [
  [/^\/api\/v1\/surveys/, 'survey'],
  [/^\/api\/v1\/questions/, 'question'],
  [/^\/api\/v1\/votes/, 'vote'],
  [/^\/api\/v1\/voters/, 'voter'],
  [/^\/api\/v1\/admin\/analytics/, 'analytics'],
  [/^\/api\/v1\/admin\/audit-logs/, 'audit_log'],
  [/^\/api\/v1\/auth/, 'admin'],
];

function inferAction(method: string, statusCode: number): AuditAction {
  if (statusCode >= 400) return 'READ'; // 失敗は意図不明なので READ 扱い、route が override 推奨
  switch (method.toUpperCase()) {
    case 'GET':
      return 'READ';
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return 'READ';
  }
}

function inferResource(fullPath: string): { type: AuditResourceType | null; id: string | null } {
  let type: AuditResourceType | null = null;
  for (const [pattern, t] of RESOURCE_BY_PREFIX) {
    if (pattern.test(fullPath)) {
      type = t;
      break;
    }
  }
  // /api/v1/{resource}/123 形式から ID 抽出
  const idMatch = fullPath.match(/^\/api\/v1\/[^/]+(?:\/admin)?\/(\d+)/);
  return { type, id: idMatch ? idMatch[1] : null };
}

declare module 'express-serve-static-core' {
  interface Locals {
    audit?: {
      action?: AuditAction | string;
      resource_type?: AuditResourceType | string;
      resource_id?: string;
      details?: Partial<AuditDetails>;
      skip?: boolean;
    };
  }
}

export function auditLogMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const startedAt = Date.now();
  // request_id の生成 + response header 設定
  // クライアント送信値は UUID 形式の場合のみ採用（偽造対策 — sec-reviewer H4対応）
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const incomingId = req.headers['x-request-id'];
  const requestId = (typeof incomingId === 'string' && UUID_RE.test(incomingId))
    ? incomingId
    : crypto.randomUUID();
  res.setHeader('X-Request-Id', requestId);

  res.locals.audit = res.locals.audit ?? {};

  res.on('finish', () => {
    const override = res.locals.audit ?? {};
    if (override.skip) return;

    const adminId = req.user?.id ?? null;
    const fullEndpoint = req.originalUrl?.split('?')[0] ?? (req.baseUrl + req.path);
    const inferred = inferAction(req.method, res.statusCode);
    const inferredResource = inferResource(fullEndpoint);
    const routePattern = (req.baseUrl ?? '') + (req.route?.path ?? '');

    AuditLogService.log({
      admin_id_snapshot: adminId ?? -1,
      admin_id: adminId,
      admin_username: req.user?.username ?? null,
      action: override.action ?? inferred,
      resource_type: override.resource_type ?? inferredResource.type,
      resource_id: override.resource_id ?? inferredResource.id,
      http_method: req.method,
      endpoint: fullEndpoint,
      route_pattern: routePattern || null,
      status_code: res.statusCode,
      ip_address: req.ip ?? 'unknown',
      user_agent: req.get('user-agent') ?? null,
      details: {
        ...override.details,
        duration_ms: Date.now() - startedAt,
        request_id: requestId,
      },
    }).catch(() => {
      // log() 内部で structured error 出力済 — ここで握り潰して本処理ブロックを防ぐ
    });
  });

  next();
}
