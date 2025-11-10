import rateLimit from 'express-rate-limit';

// CSRF対策用のトークン生成・検証
export function generateCSRFToken(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// XSS対策: HTMLエスケープ
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// 入力値サニタイゼーション
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return escapeHtml(input.trim());
  }
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  return input;
}

// レート制限（投票用）
export const voteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 50, // 50リクエスト
  message: 'Too many votes from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// レート制限（API用）
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 200, // 200リクエスト
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// SQLインジェクション対策: パラメータ化クエリを使用（pgライブラリで自動対応）

