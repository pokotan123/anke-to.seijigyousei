'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '../../../components/admin/AdminHeader';
import VoterSummaryCards from '../../../components/admin/VoterSummaryCards';
import VoterTable from '../../../components/admin/VoterTable';
import { surveyAPI, voterAPI, authAPI } from '../../../lib/api';
import type { SurveyListItem, Survey, VoterRow, VoterSummary } from '../../../lib/types';

const EMPTY_SUMMARY: VoterSummary = { total: 0, registered: 0, sent: 0, voted: 0, expired: 0 };

function buildRegistrationUrl(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/register/${token}`;
}

export default function VotersPage() {
  const router = useRouter();
  const [allSurveys, setAllSurveys] = useState<SurveyListItem[]>([]);
  const [votingSurveys, setVotingSurveys] = useState<SurveyListItem[]>([]);
  const [selectedVotingSurveyId, setSelectedVotingSurveyId] = useState<number | null>(null);
  const [linkedRegSurvey, setLinkedRegSurvey] = useState<Survey | null>(null);
  const [voters, setVoters] = useState<VoterRow[]>([]);
  const [summary, setSummary] = useState<VoterSummary>(EMPTY_SUMMARY);
  const [fields, setFields] = useState<{ name: string; required: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [votersLoading, setVotersLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isReminding, setIsReminding] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/admin/login');
        return;
      }
      try {
        await authAPI.getMe();
        const surveys: SurveyListItem[] = await surveyAPI.list();
        setAllSurveys(surveys);
        const voting = surveys.filter((s) => !s.linked_voting_survey_id);
        setVotingSurveys(voting);
        if (voting.length > 0) {
          setSelectedVotingSurveyId(voting[0].id);
        }
      } catch {
        localStorage.removeItem('token');
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!selectedVotingSurveyId) return;

    const linkedReg = allSurveys.find(
      (s) => s.linked_voting_survey_id === selectedVotingSurveyId
    );

    if (!linkedReg) {
      setLinkedRegSurvey(null);
      setVoters([]);
      setSummary(EMPTY_SUMMARY);
      setFields([]);
      setVotersLoading(false);
      setMessage('この投票アンケートには登録アンケートが紐づけられていません');
      return;
    }

    const loadVoters = async () => {
      setVotersLoading(true);
      setMessage('');
      try {
        const [voterData, regDetail] = await Promise.all([
          voterAPI.list(linkedReg.id),
          surveyAPI.get(linkedReg.id),
        ]);
        const voterList: VoterRow[] = voterData.voters ?? voterData;
        const voterSummary: VoterSummary = voterData.summary ?? EMPTY_SUMMARY;
        setVoters(voterList);
        setSummary(voterSummary);
        setLinkedRegSurvey(regDetail);
        setFields(regDetail.registration_fields ?? []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '投票者の読み込みに失敗しました';
        setMessage(errorMessage);
      } finally {
        setVotersLoading(false);
      }
    };
    loadVoters();
  }, [selectedVotingSurveyId, allSurveys]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    router.push('/admin/login');
  }, [router]);

  const handleSurveyChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedVotingSurveyId(value ? Number(value) : null);
  }, []);

  const handleSendLinks = useCallback(async () => {
    if (!linkedRegSurvey) return;
    setIsSending(true);
    setMessage('');
    try {
      const result = await voterAPI.sendLinks(linkedRegSurvey.id);
      setMessage(result.message ?? '投票リンクを送信しました');
      const voterData = await voterAPI.list(linkedRegSurvey.id);
      setVoters(voterData.voters ?? voterData);
      setSummary(voterData.summary ?? EMPTY_SUMMARY);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '送信に失敗しました';
      setMessage(errorMessage);
    } finally {
      setIsSending(false);
    }
  }, [linkedRegSurvey]);

  const handleRemind = useCallback(async () => {
    if (!linkedRegSurvey) return;
    setIsReminding(true);
    setMessage('');
    try {
      const result = await voterAPI.remind(linkedRegSurvey.id);
      setMessage(result.message ?? 'リマインドメールを送信しました');
      const voterData = await voterAPI.list(linkedRegSurvey.id);
      setVoters(voterData.voters ?? voterData);
      setSummary(voterData.summary ?? EMPTY_SUMMARY);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'リマインド送信に失敗しました';
      setMessage(errorMessage);
    } finally {
      setIsReminding(false);
    }
  }, [linkedRegSurvey]);

  const handleCopyUrl = useCallback(async () => {
    if (!linkedRegSurvey) return;
    const url = buildRegistrationUrl(linkedRegSurvey.unique_token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage('URLのコピーに失敗しました');
    }
  }, [linkedRegSurvey]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminHeader onLogout={handleLogout} activePage="voters" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h1 className="text-xl font-bold text-slate-800">投票者管理</h1>

        {/* Survey selector */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <label htmlFor="survey-select" className="block text-sm font-medium text-slate-600 mb-2">
            投票アンケート選択
          </label>
          <select
            id="survey-select"
            value={selectedVotingSurveyId ?? ''}
            onChange={handleSurveyChange}
            className="w-full sm:w-80 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          >
            <option value="">-- 選択してください --</option>
            {votingSurveys.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
        </div>

        {selectedVotingSurveyId && (
          <>
            {/* Summary cards */}
            <VoterSummaryCards summary={summary} loading={votersLoading} />

            {/* Action buttons */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSendLinks}
                  disabled={isSending}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSending ? '送信中...' : '投票リンク一括送信'}
                </button>
                <button
                  onClick={handleRemind}
                  disabled={isReminding}
                  className="px-4 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isReminding ? '送信中...' : 'リマインドメール送信'}
                </button>
              </div>

              {/* Registration URL */}
              {linkedRegSurvey && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 shrink-0">登録URL:</span>
                  <code className="flex-1 min-w-0 truncate text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700">
                    {buildRegistrationUrl(linkedRegSurvey.unique_token)}
                  </code>
                  <button
                    onClick={handleCopyUrl}
                    className="shrink-0 px-3 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                  >
                    {copied ? 'コピー済み' : 'コピー'}
                  </button>
                </div>
              )}

              {/* Status message */}
              {message && (
                <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{message}</p>
              )}
            </div>

            {/* Voter table */}
            <VoterTable voters={voters} fields={fields} loading={votersLoading} />
          </>
        )}

        {!selectedVotingSurveyId && votingSurveys.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
            <p className="text-sm text-slate-400">投票アンケートがまだ作成されていません</p>
            <p className="text-xs text-slate-400 mt-1">
              ダッシュボードから投票アンケートを作成してください
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
