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
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  registered: { label: '登録済み', color: 'bg-gray-100 text-gray-700' },
  sent: { label: '送信済み', color: 'bg-blue-100 text-blue-700' },
  voted: { label: '投票済み', color: 'bg-green-100 text-green-700' },
  expired: { label: '期限切れ', color: 'bg-red-100 text-red-700' },
};

export default function VoterManagementPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = parseInt(params.id as string);

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [summary, setSummary] = useState<VoterSummary>({
    total: 0,
    registered: 0,
    sent: 0,
    voted: 0,
    expired: 0,
  });
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
      setSummary(voterData.summary || {
        total: 0,
        registered: 0,
        sent: 0,
        voted: 0,
        expired: 0,
      });
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'データの取得に失敗しました';
      setMessage({ type: 'error', text: errorMessage });
    }
  }, [surveyId]);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/admin/login');
        return;
      }

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

    if (surveyId) {
      checkAuth();
    }
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
      if (result.sent > 0) {
        parts.push(`${result.sent}件の投票リンクを送信しました`);
      }
      if (result.already_sent > 0) {
        parts.push(`${result.already_sent}件は既に送信済みです`);
      }
      if (result.failed > 0) {
        parts.push(`${result.failed}件の送信に失敗しました`);
      }
      const hasFailure = result.failed > 0;
      const text = parts.length > 0 ? parts.join('。') + '。' : '送信対象がありません。';
      setMessage({
        type: hasFailure ? 'error' : 'success',
        text: result.errors ? `${text} エラー: ${result.errors.join(', ')}` : text,
      });
      await loadData();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : '投票リンクの送信に失敗しました';
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
      if (result.sent > 0) {
        parts.push(`${result.sent}件のリマインドメールを送信しました`);
      }
      if (result.already_voted > 0) {
        parts.push(`${result.already_voted}件は既に投票済みです`);
      }
      if (result.failed > 0) {
        parts.push(`${result.failed}件の送信に失敗しました`);
      }
      const hasFailure = result.failed > 0;
      const text = parts.length > 0 ? parts.join('。') + '。' : 'リマインド対象がありません。';
      setMessage({
        type: hasFailure ? 'error' : 'success',
        text: result.errors ? `${text} エラー: ${result.errors.join(', ')}` : text,
      });
      await loadData();
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'リマインドメールの送信に失敗しました';
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
    return new Date(dateStr).toLocaleDateString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center" role="status" aria-label="読み込み中">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/admin/surveys/${surveyId}`)}
                className="text-gray-600 hover:text-gray-800 cursor-pointer transition-colors duration-200"
              >
                ← 戻る
              </button>
              <h1 className="text-xl font-bold text-gray-900">投票者管理</h1>
              {survey && (
                <span className="text-sm text-gray-500 leading-relaxed">
                  - {survey.title}
                </span>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* サマリーカード */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
            <div className="text-xs text-gray-500 leading-relaxed">合計</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-600">{summary.registered}</div>
            <div className="text-xs text-gray-500 leading-relaxed">登録済み</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{summary.sent}</div>
            <div className="text-xs text-gray-500 leading-relaxed">送信済み</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{summary.voted}</div>
            <div className="text-xs text-gray-500 leading-relaxed">投票済み</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{summary.expired}</div>
            <div className="text-xs text-gray-500 leading-relaxed">期限切れ</div>
          </div>
        </div>

        {/* 操作ボタン */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={handleSendLinks}
              disabled={isSending}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 cursor-pointer transition-colors duration-200"
            >
              {isSending ? '送信中...' : '投票リンク一括送信'}
            </button>
            <button
              onClick={handleRemind}
              disabled={isReminding}
              className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 disabled:bg-gray-400 cursor-pointer transition-colors duration-200"
            >
              {isReminding ? '送信中...' : 'リマインドメール送信'}
            </button>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 leading-relaxed">登録URL:</span>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded max-w-[200px] truncate">
                {registrationUrl}
              </code>
              <button
                onClick={handleCopyUrl}
                className={`px-3 py-1 text-sm border rounded-lg cursor-pointer transition-colors duration-200 ${
                  copied
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                {copied ? 'コピー済み!' : 'コピー'}
              </button>
            </div>
          </div>

          {/* メッセージ */}
          {message && (
            <div
              role="alert"
              className={`mt-3 p-3 rounded-lg text-sm leading-relaxed ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* 投票者テーブル */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    メール
                  </th>
                  {fields.map((field) => (
                    <th
                      key={field.name}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500"
                    >
                      {field.name}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    ステータス
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    登録日時
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    リンク送信
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    投票日時
                  </th>
                </tr>
              </thead>
              <tbody>
                {voters.length === 0 ? (
                  <tr>
                    <td
                      colSpan={fields.length + 5}
                      className="px-4 py-8 text-center text-sm text-gray-500 leading-relaxed"
                    >
                      投票者がまだ登録されていません。
                    </td>
                  </tr>
                ) : (
                  voters.map((voter) => (
                    <tr key={voter.id} className="border-b last:border-b-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{voter.email}</td>
                      {fields.map((field) => (
                        <td key={field.name} className="px-4 py-3 text-sm text-gray-700">
                          {voter.registration_data?.[field.name] || '-'}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                            STATUS_LABELS[voter.status]?.color || 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {STATUS_LABELS[voter.status]?.label || voter.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(voter.registered_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(voter.link_sent_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(voter.voted_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
