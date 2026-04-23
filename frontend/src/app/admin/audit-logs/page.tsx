'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '../../../components/admin/AdminHeader';
import { authAPI } from '../../../lib/api';
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AuditLogRow {
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

interface ListResponse {
  rows: AuditLogRow[];
  total: number;
  limit: number;
  offset: number;
}

const ACTION_OPTIONS = ['', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT'];
const RESOURCE_OPTIONS = ['', 'survey', 'question', 'option', 'vote', 'voter', 'admin', 'audit_log', 'analytics'];

const ACTION_COLOR: Record<string, string> = {
  LOGIN: 'bg-emerald-100 text-emerald-700',
  LOGOUT: 'bg-slate-100 text-slate-700',
  LOGIN_FAILED: 'bg-red-100 text-red-700',
  CREATE: 'bg-blue-100 text-blue-700',
  READ: 'bg-slate-100 text-slate-600',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
  EXPORT: 'bg-violet-100 text-violet-700',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function nDaysAgoIso(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function fiscalYearRange(offset = 0): { from: string; to: string } {
  // 日本の年度: 4/1 〜 翌3/31
  const now = new Date();
  const year = now.getFullYear() - (now.getMonth() < 3 ? 1 : 0) + offset;
  return {
    from: `${year}-04-01`,
    to: `${year + 1}-04-01`,
  };
}

function quarterRange(): { from: string; to: string } {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), q * 3, 1);
  const end = new Date(now.getFullYear(), q * 3 + 3, 1);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export default function AuditLogsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    admin_id: '',
    action: '',
    resource_type: '',
    resource_id: '',
    from_date: nDaysAgoIso(30),
    to_date: todayIso(),
  });
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [detailRow, setDetailRow] = useState<AuditLogRow | null>(null);

  // 認証チェック + admin 必須
  useEffect(() => {
    const check = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/admin/login');
        return;
      }
      try {
        const me = await authAPI.getMe();
        if (me.role !== 'admin') {
          router.push('/admin/dashboard');
          return;
        }
        setIsAdmin(true);
      } catch {
        localStorage.removeItem('token');
        router.push('/admin/login');
      } finally {
        setAuthChecked(true);
      }
    };
    check();
  }, [router]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const params: Record<string, string | number> = { limit, offset };
      Object.entries(filter).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const res = await axios.get<ListResponse>(`${API_URL}/api/v1/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });
      setRows(res.data.rows);
      setTotal(res.data.total);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'ログの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [filter, limit, offset]);

  useEffect(() => {
    if (isAdmin) fetchLogs();
  }, [isAdmin, fetchLogs]);

  const exportCsv = async () => {
    if (!filter.from_date || !filter.to_date) {
      setError('CSV出力には期間（from_date / to_date）が必須です');
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const params: Record<string, string> = {};
      Object.entries(filter).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const res = await axios.get(`${API_URL}/api/v1/admin/audit-logs/export/csv`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs_${filter.from_date}_${filter.to_date}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      // blob エラーレスポンスの解析
      if (e.response?.data instanceof Blob) {
        const text = await e.response.data.text();
        try {
          const j = JSON.parse(text);
          setError(j.error ?? 'CSV出力に失敗しました');
        } catch {
          setError('CSV出力に失敗しました');
        }
      } else {
        setError(e.response?.data?.error ?? 'CSV出力に失敗しました');
      }
    } finally {
      setExporting(false);
    }
  };

  const applyPreset = (preset: 'quarter' | 'fy' | 'prev-fy' | 'all-retained') => {
    if (preset === 'quarter') {
      const r = quarterRange();
      setFilter((f) => ({ ...f, from_date: r.from, to_date: r.to }));
    } else if (preset === 'fy') {
      const r = fiscalYearRange(0);
      setFilter((f) => ({ ...f, from_date: r.from, to_date: r.to }));
    } else if (preset === 'prev-fy') {
      const r = fiscalYearRange(-1);
      setFilter((f) => ({ ...f, from_date: r.from, to_date: r.to }));
    } else if (preset === 'all-retained') {
      // 保持中の全期間: retention=365日想定で from を1年前に
      setFilter((f) => ({ ...f, from_date: nDaysAgoIso(365), to_date: todayIso() }));
    }
    setOffset(0);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/admin/login');
  };

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">読み込み中...</div>;
  }
  if (!isAdmin) return null;

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader onLogout={handleLogout} activePage="audit-logs" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* ページヘッダ */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-slate-800">監査ログ</h1>
          <p className="text-xs text-slate-500 mt-1">個人情報取扱覚書 第6条3項対応</p>
        </div>

        {/* モバイル警告 */}
        <div className="md:hidden mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-sm">
          ⚠️ この画面はPC・タブレット表示推奨です
        </div>

        {/* 期間プリセット + CSV出力 */}
        <div className="bg-white border border-slate-200 rounded p-4 mb-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-sm font-medium text-slate-700">期間プリセット:</span>
            <button onClick={() => applyPreset('quarter')} className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50">今四半期</button>
            <button onClick={() => applyPreset('fy')} className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50">今年度</button>
            <button onClick={() => applyPreset('prev-fy')} className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50">前年度（保持期間内のみ）</button>
            <button onClick={() => applyPreset('all-retained')} className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50">保持中の全期間</button>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">開始</span>
              <input type="date" value={filter.from_date} onChange={(e) => setFilter({ ...filter, from_date: e.target.value })} className="border border-slate-300 rounded px-2 py-1" />
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">終了</span>
              <input type="date" value={filter.to_date} onChange={(e) => setFilter({ ...filter, to_date: e.target.value })} className="border border-slate-300 rounded px-2 py-1" />
            </label>
            <button
              onClick={exportCsv}
              disabled={exporting}
              className="ml-auto px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {exporting ? 'CSV出力中...' : 'CSVダウンロード（覚書提出用）'}
            </button>
          </div>
        </div>

        {/* 絞り込みフィルタ */}
        <div className="bg-white border border-slate-200 rounded p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">管理者ID</span>
              <input type="number" value={filter.admin_id} onChange={(e) => setFilter({ ...filter, admin_id: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1" />
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">操作</span>
              <select value={filter.action} onChange={(e) => setFilter({ ...filter, action: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1">
                {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a || '— 全て —'}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">リソース種別</span>
              <select value={filter.resource_type} onChange={(e) => setFilter({ ...filter, resource_type: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1">
                {RESOURCE_OPTIONS.map((r) => <option key={r} value={r}>{r || '— 全て —'}</option>)}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-slate-600 mb-1">リソースID</span>
              <input type="text" value={filter.resource_id} onChange={(e) => setFilter({ ...filter, resource_id: e.target.value })} className="w-full border border-slate-300 rounded px-2 py-1" />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={() => { setOffset(0); fetchLogs(); }} className="px-4 py-1 text-sm bg-slate-700 text-white rounded hover:bg-slate-800">絞り込む</button>
          </div>
        </div>

        {/* エラー */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
            {error}
          </div>
        )}

        {/* テーブル */}
        <div className="bg-white border border-slate-200 rounded overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between text-sm">
            <div className="text-slate-600">
              {loading ? '読み込み中...' : `${total} 件中 ${offset + 1}〜${Math.min(offset + limit, total)} 件表示`}
            </div>
            <div className="text-xs text-slate-500">期間: {filter.from_date} 〜 {filter.to_date}</div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">スケルトン読み込み中...</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500 mb-3">該当期間の操作ログはありません</p>
              <button onClick={() => applyPreset('all-retained')} className="text-sm text-primary-600 hover:underline">期間を保持中の全期間に変更</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" aria-label={`監査ログ ${total}件中 ${rows.length}件表示`}>
                <caption className="sr-only">監査ログ一覧（{total}件中 {rows.length}件表示、期間: {filter.from_date} 〜 {filter.to_date}）</caption>
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">日時</th>
                    <th className="text-left px-3 py-2">管理者</th>
                    <th className="text-left px-3 py-2">操作</th>
                    <th className="text-left px-3 py-2">リソース</th>
                    <th className="text-left px-3 py-2">エンドポイント</th>
                    <th className="text-left px-3 py-2">ステータス</th>
                    <th className="text-left px-3 py-2">IP</th>
                    <th className="text-left px-3 py-2">詳細</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.created_at}</td>
                      <td className="px-3 py-2">{r.admin_username ?? `id:${r.admin_id_snapshot}`}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${ACTION_COLOR[r.action] ?? 'bg-slate-100 text-slate-700'}`}>
                          {r.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{r.resource_type ?? '—'}{r.resource_id ? `:${r.resource_id}` : ''}</td>
                      <td className="px-3 py-2 text-slate-500 truncate max-w-xs">{r.http_method} {r.endpoint}</td>
                      <td className="px-3 py-2">
                        <span className={r.status_code && r.status_code >= 400 ? 'text-red-600' : 'text-slate-600'}>
                          {r.status_code}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{r.ip_address ?? '—'}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => setDetailRow(r)} className="text-primary-600 text-xs hover:underline">表示</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ページング */}
          {!loading && rows.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-sm">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1 border border-slate-300 rounded disabled:opacity-30"
              >前へ</button>
              <span className="text-slate-600">{currentPage} / {totalPages}</span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1 border border-slate-300 rounded disabled:opacity-30"
              >次へ</button>
            </div>
          )}
        </div>
      </main>

      {/* 詳細モーダル */}
      {detailRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailRow(null)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">監査ログ詳細 #{detailRow.id}</h2>
              <button onClick={() => setDetailRow(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <div className="p-5 text-sm">
              <dl className="grid grid-cols-3 gap-2">
                <dt className="text-slate-500">日時</dt><dd className="col-span-2">{detailRow.created_at}</dd>
                <dt className="text-slate-500">管理者ID(snapshot)</dt><dd className="col-span-2">{detailRow.admin_id_snapshot}</dd>
                <dt className="text-slate-500">管理者ID(FK)</dt><dd className="col-span-2">{detailRow.admin_id ?? '—'}</dd>
                <dt className="text-slate-500">管理者名</dt><dd className="col-span-2">{detailRow.admin_username ?? '—'}</dd>
                <dt className="text-slate-500">操作</dt><dd className="col-span-2">{detailRow.action}</dd>
                <dt className="text-slate-500">リソース</dt><dd className="col-span-2">{detailRow.resource_type ?? '—'}{detailRow.resource_id ? `:${detailRow.resource_id}` : ''}</dd>
                <dt className="text-slate-500">メソッド</dt><dd className="col-span-2">{detailRow.http_method ?? '—'}</dd>
                <dt className="text-slate-500">エンドポイント</dt><dd className="col-span-2 break-all">{detailRow.endpoint ?? '—'}</dd>
                <dt className="text-slate-500">ルートパターン</dt><dd className="col-span-2 break-all">{detailRow.route_pattern ?? '—'}</dd>
                <dt className="text-slate-500">ステータス</dt><dd className="col-span-2">{detailRow.status_code ?? '—'}</dd>
                <dt className="text-slate-500">IP</dt><dd className="col-span-2">{detailRow.ip_address ?? '—'}</dd>
                <dt className="text-slate-500">User-Agent</dt><dd className="col-span-2 break-all text-xs">{detailRow.user_agent ?? '—'}</dd>
              </dl>
              <div className="mt-4">
                <h3 className="text-slate-500 mb-1">詳細(JSON)</h3>
                <pre className="bg-slate-50 p-3 rounded text-xs overflow-auto">
                  {detailRow.details ? JSON.stringify(detailRow.details, null, 2) : '—'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
