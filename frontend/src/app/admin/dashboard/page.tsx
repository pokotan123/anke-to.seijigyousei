'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { surveyAPI, voterAPI, authAPI } from '../../../lib/api';

interface Survey {
  id: number;
  title: string;
  status: string;
  unique_token: string;
  created_at: string;
  linked_voting_survey_id: number | null;
}

interface VoterSummary {
  total: number;
  registered: number;
  sent: number;
  voted: number;
  expired: number;
}

interface VoterRow {
  id: number;
  email: string;
  status: string;
  registered_at: string | null;
  link_sent_at: string | null;
  voted_at: string | null;
  reminder_sent_at: string | null;
  registration_data: Record<string, string> | null;
  surveyTitle: string;
  surveyId: number;
}

type Tab = 'voting' | 'registration' | 'voters';

const statusLabel = (s: string) =>
  s === 'draft' ? '下書き' : s === 'published' ? '公開中' : '終了';
const statusColor = (s: string) =>
  s === 'published'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : s === 'draft'
      ? 'bg-slate-50 text-slate-600 border-slate-200'
      : 'bg-red-50 text-red-600 border-red-200';

const voterStatusLabels: Record<string, { label: string; color: string }> = {
  registered: { label: '登録済み', color: 'bg-slate-100 text-slate-600' },
  sent: { label: '送信済み', color: 'bg-primary-50 text-primary-700' },
  voted: { label: '投票済み', color: 'bg-emerald-50 text-emerald-700' },
  expired: { label: '期限切れ', color: 'bg-red-50 text-red-600' },
};

export default function DashboardPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('voting');
  const [allVoters, setAllVoters] = useState<VoterRow[]>([]);
  const [voterSummary, setVoterSummary] = useState<VoterSummary>({ total: 0, registered: 0, sent: 0, voted: 0, expired: 0 });
  const [votersLoading, setVotersLoading] = useState(false);
  const [voterFilter, setVoterFilter] = useState<string>('all');

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) { router.push('/admin/login'); return; }
      try {
        await authAPI.getMe();
        const data = await surveyAPI.list();
        setSurveys(data);
      } catch (err) {
        localStorage.removeItem('token');
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // 投票者タブが選ばれたら全投票者を取得
  useEffect(() => {
    if (activeTab !== 'voters' || surveys.length === 0) return;
    const loadVoters = async () => {
      setVotersLoading(true);
      try {
        const votingSurveys = surveys.filter((s) => !s.linked_voting_survey_id);
        const results = await Promise.all(
          votingSurveys.map(async (survey) => {
            try {
              const data = await voterAPI.list(survey.id);
              return { survey, voters: data.voters || [], summary: data.summary };
            } catch { return { survey, voters: [], summary: null }; }
          })
        );
        const rows: VoterRow[] = [];
        const totals: VoterSummary = { total: 0, registered: 0, sent: 0, voted: 0, expired: 0 };
        for (const r of results) {
          for (const v of r.voters) {
            rows.push({ ...v, surveyTitle: r.survey.title, surveyId: r.survey.id });
          }
          if (r.summary) {
            totals.total += r.summary.total;
            totals.registered += r.summary.registered;
            totals.sent += r.summary.sent;
            totals.voted += r.summary.voted;
            totals.expired += r.summary.expired;
          }
        }
        setAllVoters(rows);
        setVoterSummary(totals);
      } catch { /* ignore */ }
      finally { setVotersLoading(false); }
    };
    loadVoters();
  }, [activeTab, surveys]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/admin/login');
  };

  const handleDelete = async (surveyId: number, surveyTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`「${surveyTitle}」を削除しますか？\nこの操作は取り消せません。`)) return;
    try {
      await surveyAPI.delete(surveyId);
      alert('アンケートを削除しました');
      const data = await surveyAPI.list();
      setSurveys(data);
    } catch (err: any) {
      alert(err.response?.data?.error || '削除に失敗しました');
    }
  };

  const handleExportCSV = async (surveyId: number, surveyTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const blob = await surveyAPI.exportCSV(surveyId);
      if (!blob || blob.size === 0) { alert('CSVデータが空です'); return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${surveyTitle.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'CSVエクスポートに失敗しました');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const votingSurveys = surveys.filter((s) => !s.linked_voting_survey_id);
  const regSurveys = surveys.filter((s) => !!s.linked_voting_survey_id);

  const filteredVoters = voterFilter === 'all'
    ? allVoters
    : allVoters.filter((v) => v.status === voterFilter);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'voting', label: '投票アンケート', count: votingSurveys.length },
    { key: 'registration', label: '登録アンケート', count: regSurveys.length },
    { key: 'voters', label: '投票者管理', count: voterSummary.total },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-slate-200" aria-label="管理メニュー">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex justify-between h-14">
            <div className="flex items-center gap-1">
              <svg className="w-5 h-5 text-primary-600 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
              <span className="font-bold text-slate-800">管理画面</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/admin/analytics" className="text-slate-500 hover:text-primary-600 transition-colors">分析</Link>
              <Link href="/admin/votes" className="text-slate-500 hover:text-primary-600 transition-colors">投票データ</Link>
              <button onClick={handleLogout} className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">ログアウト</button>
            </div>
          </div>
        </div>
      </nav>

      {/* タブ切り替え */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-0 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-5 py-3 text-sm font-medium border-b-2 cursor-pointer transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.label}
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-primary-50 text-primary-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">

        {/* ===== 投票アンケートタブ ===== */}
        {activeTab === 'voting' && (
          <>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-primary-500 rounded-full" />
                <h2 className="text-lg font-bold text-slate-800">投票アンケート</h2>
              </div>
              <Link
                href="/admin/surveys/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                新規作成
              </Link>
            </div>

            {votingSurveys.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                <p className="text-slate-500 text-sm mb-4">投票アンケートがありません</p>
                <button onClick={() => router.push('/admin/surveys/new')} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 cursor-pointer transition-colors">
                  最初のアンケートを作成
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {votingSurveys.map((survey) => {
                  const linkedReg = surveys.find((s) => s.linked_voting_survey_id === survey.id);
                  return (
                    <Link key={survey.id} href={`/admin/surveys/${survey.id}`} className="block bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-2">
                            <h3 className="font-semibold text-slate-800 truncate">{survey.title}</h3>
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${statusColor(survey.status)}`}>
                              {statusLabel(survey.status)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono break-all mb-1">
                            {typeof window !== 'undefined' && `${window.location.origin}/vote/${survey.unique_token}`}
                          </p>
                          {linkedReg && (
                            <p className="text-xs text-primary-600 mt-1.5">
                              登録アンケート: {linkedReg.title}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-400">
                            {new Date(survey.created_at).toLocaleDateString('ja-JP')}
                          </span>
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/admin/surveys/${survey.id}/voters`); }}
                            className="px-2.5 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-md border border-primary-200 cursor-pointer transition-colors"
                          >
                            投票者
                          </button>
                          <button
                            onClick={(e) => handleExportCSV(survey.id, survey.title, e)}
                            className="px-2.5 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 rounded-md border border-emerald-200 cursor-pointer transition-colors"
                          >
                            CSV
                          </button>
                          <button
                            onClick={(e) => handleDelete(survey.id, survey.title, e)}
                            className="px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-md border border-red-200 cursor-pointer transition-colors"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===== 登録アンケートタブ ===== */}
        {activeTab === 'registration' && (
          <>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-teal-500 rounded-full" />
                <h2 className="text-lg font-bold text-slate-800">登録アンケート</h2>
              </div>
              <Link
                href="/admin/surveys/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                新規作成
              </Link>
            </div>

            {regSurveys.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
                <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <p className="text-slate-500 text-sm mb-2">登録アンケートがありません</p>
                <p className="text-xs text-slate-400">投票アンケートを作成後、編集画面で登録アンケートを紐づけてください</p>
              </div>
            ) : (
              <div className="space-y-3">
                {regSurveys.map((survey) => {
                  const linkedVoting = surveys.find((s) => s.id === survey.linked_voting_survey_id);
                  return (
                    <Link key={survey.id} href={`/admin/surveys/${survey.id}`} className="block bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-2">
                            <h3 className="font-semibold text-slate-800 truncate">{survey.title}</h3>
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${statusColor(survey.status)}`}>
                              {statusLabel(survey.status)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono break-all mb-1">
                            {typeof window !== 'undefined' && `${window.location.origin}/register/${survey.unique_token}`}
                          </p>
                          {linkedVoting && (
                            <p className="text-xs text-teal-600 mt-1.5">
                              紐づけ先: {linkedVoting.title}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-400">
                            {new Date(survey.created_at).toLocaleDateString('ja-JP')}
                          </span>
                          <button
                            onClick={(e) => handleExportCSV(survey.id, survey.title, e)}
                            className="px-2.5 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 rounded-md border border-emerald-200 cursor-pointer transition-colors"
                          >
                            CSV
                          </button>
                          <button
                            onClick={(e) => handleDelete(survey.id, survey.title, e)}
                            className="px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-md border border-red-200 cursor-pointer transition-colors"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ===== 投票者管理タブ ===== */}
        {activeTab === 'voters' && (
          <>
            {/* サマリーカード */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              {[
                { label: '合計', value: voterSummary.total, color: 'text-slate-800' },
                { label: '登録済み', value: voterSummary.registered, color: 'text-slate-500' },
                { label: '送信済み', value: voterSummary.sent, color: 'text-primary-600' },
                { label: '投票済み', value: voterSummary.voted, color: 'text-emerald-600' },
                { label: '期限切れ', value: voterSummary.expired, color: 'text-red-500' },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl border border-slate-200/80 p-4 text-center">
                  <div className={`text-2xl font-bold ${item.color}`}>{votersLoading ? '-' : item.value}</div>
                  <div className="text-xs text-slate-400 mt-1">{item.label}</div>
                </div>
              ))}
            </div>

            {/* フィルター */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-500">絞り込み:</span>
              {[
                { key: 'all', label: 'すべて' },
                { key: 'registered', label: '登録済み' },
                { key: 'sent', label: '送信済み' },
                { key: 'voted', label: '投票済み' },
                { key: 'expired', label: '期限切れ' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setVoterFilter(f.key)}
                  className={`px-3 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${
                    voterFilter === f.key
                      ? 'bg-primary-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* テーブル */}
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
              {votersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
                  <span className="ml-3 text-sm text-slate-400">読み込み中...</span>
                </div>
              ) : filteredVoters.length === 0 ? (
                <div className="text-center py-16">
                  <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                  <p className="text-sm text-slate-400">投票者がいません</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">メール</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">アンケート</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">ステータス</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">登録日時</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">リンク送信</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">投票日時</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVoters.map((voter) => (
                        <tr key={voter.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-sm text-slate-800">{voter.email}</td>
                          <td className="px-4 py-3">
                            <Link href={`/admin/surveys/${voter.surveyId}`} className="text-xs text-primary-600 hover:text-primary-700 transition-colors">
                              {voter.surveyTitle}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${voterStatusLabels[voter.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                              {voterStatusLabels[voter.status]?.label || voter.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-400">{formatDate(voter.registered_at)}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{formatDate(voter.link_sent_at)}</td>
                          <td className="px-4 py-3 text-xs text-slate-400">{formatDate(voter.voted_at)}</td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/admin/surveys/${voter.surveyId}/voters`}
                              className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
                            >
                              詳細
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
