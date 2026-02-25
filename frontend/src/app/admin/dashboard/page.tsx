'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { surveyAPI, authAPI } from '../../../lib/api';

interface Survey {
  id: number;
  title: string;
  status: string;
  unique_token: string;
  created_at: string;
  linked_voting_survey_id: number | null;
}

const statusLabel = (s: string) =>
  s === 'draft' ? '下書き' : s === 'published' ? '公開中' : '終了';
const statusColor = (s: string) =>
  s === 'published'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : s === 'draft'
      ? 'bg-slate-50 text-slate-600 border-slate-200'
      : 'bg-red-50 text-red-600 border-red-200';

export default function DashboardPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/admin/login');
        return;
      }

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

  const votingSurveys = surveys.filter((s) => !s.linked_voting_survey_id);
  const regSurveys = surveys.filter((s) => !!s.linked_voting_survey_id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
        {/* 投票アンケート */}
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 bg-primary-500 rounded-full" />
            <h2 className="text-lg font-bold text-slate-800">投票アンケート</h2>
            <span className="text-xs text-slate-400">{votingSurveys.length}件</span>
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
          <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center mb-10">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-slate-500 text-sm mb-4">投票アンケートがありません</p>
            <button onClick={() => router.push('/admin/surveys/new')} className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 cursor-pointer transition-colors">
              最初のアンケートを作成
            </button>
          </div>
        ) : (
          <div className="space-y-3 mb-10">
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

        {/* 登録アンケート */}
        {regSurveys.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 bg-teal-500 rounded-full" />
              <h2 className="text-lg font-bold text-slate-800">登録アンケート</h2>
              <span className="text-xs text-slate-400">{regSurveys.length}件</span>
            </div>
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
          </>
        )}
      </main>
    </div>
  );
}
