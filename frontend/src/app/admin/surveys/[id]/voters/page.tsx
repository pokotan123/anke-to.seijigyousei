'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { surveyAPI, voterAPI, authAPI } from '../../../../../lib/api';
import type { Survey, VoterSummary, VoterRow } from '../../../../../lib/types';
import VoterSummaryCards from '../../../../../components/admin/VoterSummaryCards';
import VoterTable from '../../../../../components/admin/VoterTable';

type Message = { type: 'success' | 'error'; text: string };

const EMPTY_SUMMARY: VoterSummary = { total: 0, registered: 0, sent: 0, voted: 0, expired: 0 };

function buildResultMessage(
  counts: { sent?: number; already_sent?: number; already_voted?: number; failed?: number; errors?: string[] },
  sentLabel: string,
  fallback: string,
): Message {
  const parts: string[] = [];
  if ((counts.sent ?? 0) > 0) parts.push(`${counts.sent}件の${sentLabel}を送信しました`);
  if ((counts.already_sent ?? 0) > 0) parts.push(`${counts.already_sent}件は既に送信済みです`);
  if ((counts.already_voted ?? 0) > 0) parts.push(`${counts.already_voted}件は既に投票済みです`);
  if ((counts.failed ?? 0) > 0) parts.push(`${counts.failed}件の送信に失敗しました`);
  const hasFailure = (counts.failed ?? 0) > 0;
  const text = parts.length > 0 ? parts.join('\u3002') + '\u3002' : `${fallback}対象がありません。`;
  return {
    type: hasFailure ? 'error' : 'success',
    text: counts.errors ? `${text} エラー: ${counts.errors.join(', ')}` : text,
  };
}

export default function VoterManagementPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = parseInt(params.id as string);

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [summary, setSummary] = useState<VoterSummary>(EMPTY_SUMMARY);
  const [fields, setFields] = useState<{ name: string; required: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isReminding, setIsReminding] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
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
      setSummary(voterData.summary || EMPTY_SUMMARY);
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
      setMessage(buildResultMessage(result, '投票リンク', '送信'));
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
      setMessage(buildResultMessage(result, 'リマインドメール', 'リマインド'));
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-4">
            <button
              onClick={() => router.push(`/admin/surveys/${surveyId}`)}
              className="text-primary-600 hover:text-primary-700 text-sm cursor-pointer transition-colors"
            >
              &larr; アンケート編集
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
        <div className="mb-6">
          <VoterSummaryCards summary={summary} />
        </div>

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

        <VoterTable voters={voters} fields={fields} />
      </main>
    </div>
  );
}
