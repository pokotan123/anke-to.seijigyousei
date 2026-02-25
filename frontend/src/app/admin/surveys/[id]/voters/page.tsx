'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { surveyAPI, voterAPI, authAPI } from '../../../../../lib/api';

interface Voter {
  id: number;
  email: string;
  status: string;
  registered_at: string | null;
  link_sent_at: string | null;
  voted_at: string | null;
  reminder_sent_at: string | null;
  registration_data: Record<string, string> | null;
}

interface VoterSummary {
  total: number;
  registered: number;
  sent: number;
  voted: number;
  expired: number;
}

interface Survey {
  id: number;
  title: string;
  unique_token: string;
  registration_fields?: { name: string; required: boolean }[];
  linked_voting_survey_id: number | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  registered: { label: '登録済み', color: 'bg-slate-100 text-slate-600' },
  sent: { label: '送信済み', color: 'bg-primary-50 text-primary-700' },
  voted: { label: '投票済み', color: 'bg-emerald-50 text-emerald-700' },
  expired: { label: '期限切れ', color: 'bg-red-50 text-red-600' },
};

export default function VoterManagementPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = parseInt(params.id as string);

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [summary, setSummary] = useState<VoterSummary>({ total: 0, registered: 0, sent: 0, voted: 0, expired: 0 });
  const [fields, setFields] = useState<{ name: string; required: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isReminding, setIsReminding] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [surveyData, voterData] = await Promise.all([
        surveyAPI.get(surveyId),
        voterAPI.list(surveyId),
      ]);
      setSurvey(surveyData);
      setFields(surveyData.registration_fields || []);
      setVoters(voterData.voters || []);
      setSummary(voterData.summary || { total: 0, registered: 0, sent: 0, voted: 0, expired: 0 });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'データの取得に失敗しました';
      setMessage({ type: 'error', text: errorMessage });
    }
  }, [surveyId]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/admin/login'); return; }
      try {
        await authAPI.getMe();
        await loadData();
      } catch {
        localStorage.removeItem('token');
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };
    if (surveyId) checkAuth();
  }, [surveyId, router, loadData]);

  const registrationUrl = survey
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register/${survey.unique_token}`
    : '';

  const handleSendLinks = async () => {
    setIsSending(true);
    setMessage(null);
    try {
      const result = await voterAPI.sendLinks(surveyId);
      const parts: string[] = [];
      if (result.sent > 0) parts.push(`${result.sent}件の投票リンクを送信しました`);
      if (result.already_sent > 0) parts.push(`${result.already_sent}件は既に送信済みです`);
      if (result.failed > 0) parts.push(`${result.failed}件の送信に失敗しました`);
      const hasFailure = result.failed > 0;
      const text = parts.length > 0 ? parts.join('。') + '。' : '送信対象がありません。';
      setMessage({
        type: hasFailure ? 'error' : 'success',
        text: result.errors ? `${text} エラー: ${result.errors.join(', ')}` : text,
      });
      await loadData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '投票リンクの送信に失敗しました';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsSending(false);
    }
  };

  const handleRemind = async () => {
    setIsReminding(true);
    setMessage(null);
    try {
      const result = await voterAPI.remind(surveyId);
      const parts: string[] = [];
      if (result.sent > 0) parts.push(`${result.sent}件のリマインドメールを送信しました`);
      if (result.already_voted > 0) parts.push(`${result.already_voted}件は既に投票済みです`);
      if (result.failed > 0) parts.push(`${result.failed}件の送信に失敗しました`);
      const hasFailure = result.failed > 0;
      const text = parts.length > 0 ? parts.join('。') + '。' : 'リマインド対象がありません。';
      setMessage({
        type: hasFailure ? 'error' : 'success',
        text: result.errors ? `${text} エラー: ${result.errors.join(', ')}` : text,
      });
      await loadData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'リマインドメールの送信に失敗しました';
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsReminding(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(registrationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage({ type: 'error', text: 'URLのコピーに失敗しました' });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-4">
            <button
              onClick={() => router.push(`/admin/surveys/${surveyId}`)}
              className="text-primary-600 hover:text-primary-700 text-sm cursor-pointer transition-colors"
            >
              ← アンケート編集
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="text-slate-500 hover:text-slate-700 text-sm cursor-pointer transition-colors"
            >
              ダッシュボード
            </button>
            <div className="flex-1" />
            <h1 className="font-bold text-slate-800 text-sm">投票者管理</h1>
            {survey && <span className="text-xs text-slate-400">- {survey.title}</span>}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
        {/* サマリーカード */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: '合計', value: summary.total, color: 'text-slate-800' },
            { label: '登録済み', value: summary.registered, color: 'text-slate-500' },
            { label: '送信済み', value: summary.sent, color: 'text-primary-600' },
            { label: '投票済み', value: summary.voted, color: 'text-emerald-600' },
            { label: '期限切れ', value: summary.expired, color: 'text-red-500' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-xl border border-slate-200/80 p-4 text-center">
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
              <div className="text-xs text-slate-400 mt-1">{item.label}</div>
            </div>
          ))}
        </div>

        {/* 操作パネル */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={handleSendLinks}
              disabled={isSending}
              className="px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {isSending ? '送信中...' : '投票リンク一括送信'}
            </button>
            <button
              onClick={handleRemind}
              disabled={isReminding}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {isReminding ? '送信中...' : 'リマインドメール送信'}
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">登録URL:</span>
              <code className="text-xs bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg max-w-[200px] truncate text-slate-500 font-mono">
                {registrationUrl}
              </code>
              <button
                onClick={handleCopyUrl}
                className={`px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${
                  copied
                    ? 'border border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border border-slate-200 hover:bg-slate-50 text-slate-600'
                }`}
              >
                {copied ? 'コピー済み' : 'コピー'}
              </button>
            </div>
          </div>

          {message && (
            <div
              role="alert"
              className={`mt-4 p-3 rounded-xl text-sm leading-relaxed ${
                message.type === 'success'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* 投票者テーブル */}
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500">メール</th>
                  {fields.map((field) => (
                    <th key={field.name} scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                      {field.name}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500">ステータス</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500">登録日時</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500">リンク送信</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500">投票日時</th>
                </tr>
              </thead>
              <tbody>
                {voters.length === 0 ? (
                  <tr>
                    <td colSpan={fields.length + 4} className="px-4 py-16 text-center">
                      <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                      <p className="text-sm text-slate-400">投票者がまだ登録されていません</p>
                      <p className="text-xs text-slate-400 mt-1">登録URLを配布して投票者を集めてください</p>
                    </td>
                  </tr>
                ) : (
                  voters.map((voter) => (
                    <tr key={voter.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-800">{voter.email}</td>
                      {fields.map((field) => (
                        <td key={field.name} className="px-4 py-3 text-sm text-slate-600">
                          {voter.registration_data?.[field.name] || '-'}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_LABELS[voter.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                          {STATUS_LABELS[voter.status]?.label || voter.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(voter.registered_at)}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(voter.link_sent_at)}</td>
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(voter.voted_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
