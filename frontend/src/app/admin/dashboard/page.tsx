'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AdminHeader from '../../../components/admin/AdminHeader';
import SurveyCard from '../../../components/admin/SurveyCard';
import SurveyTypeSelectorModal from '../../../components/admin/SurveyTypeSelectorModal';
import { surveyAPI, authAPI } from '../../../lib/api';
import type { SurveyListItem } from '../../../lib/types';

type Tab = 'voting' | 'registration';

export default function DashboardPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<SurveyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('voting');
  const [showTypeSelector, setShowTypeSelector] = useState(false);

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
      } catch {
        localStorage.removeItem('token');
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    router.push('/admin/login');
  }, [router]);

  const handleDelete = useCallback(async (surveyId: number, surveyTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`「${surveyTitle}」を削除しますか？\nこの操作は取り消せません。`)) return;
    try {
      await surveyAPI.delete(surveyId);
      alert('アンケートを削除しました');
      const data = await surveyAPI.list();
      setSurveys(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '削除に失敗しました';
      alert(message);
    }
  }, []);

  const handleExportCSV = useCallback(async (surveyId: number, surveyTitle: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const blob = await surveyAPI.exportCSV(surveyId);
      if (!blob || blob.size === 0) {
        alert('CSVデータが空です');
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${surveyTitle.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'CSVエクスポートに失敗しました';
      alert(message);
    }
  }, []);

  const handleVoters = useCallback((surveyId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/admin/surveys/${surveyId}/voters`);
  }, [router]);

  const votingSurveys = surveys.filter((s) => !s.linked_voting_survey_id);
  const regSurveys = surveys.filter((s) => !!s.linked_voting_survey_id);

  const tabs: ReadonlyArray<{ key: Tab; label: string; count: number }> = [
    { key: 'voting', label: '投票アンケート', count: votingSurveys.length },
    { key: 'registration', label: '登録アンケート', count: regSurveys.length },
  ];

  const currentSurveys = activeTab === 'voting' ? votingSurveys : regSurveys;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader onLogout={handleLogout} activePage="dashboard" />

      {/* Tab switcher */}
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
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-1 h-6 rounded-full ${activeTab === 'voting' ? 'bg-primary-500' : 'bg-teal-500'}`} />
            <h2 className="text-lg font-bold text-slate-800">
              {activeTab === 'voting' ? '投票アンケート' : '登録アンケート'}
            </h2>
          </div>
          <button
            onClick={() => setShowTypeSelector(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 cursor-pointer transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            新規アンケート
          </button>
        </div>

        {currentSurveys.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
              {activeTab === 'voting' ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              )}
            </svg>
            <p className="text-slate-500 text-sm mb-4">
              {activeTab === 'voting' ? '投票アンケートがありません' : '登録アンケートがありません'}
            </p>
            <button
              onClick={() => setShowTypeSelector(true)}
              className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 cursor-pointer transition-colors"
            >
              最初のアンケートを作成
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {currentSurveys.map((survey) => {
              const linkedSurvey = activeTab === 'voting'
                ? surveys.find((s) => s.linked_voting_survey_id === survey.id)
                : surveys.find((s) => s.id === survey.linked_voting_survey_id);
              return (
                <SurveyCard
                  key={survey.id}
                  survey={survey}
                  type={activeTab}
                  linkedSurvey={linkedSurvey}
                  onDelete={handleDelete}
                  onExportCSV={handleExportCSV}
                  onVoters={activeTab === 'voting' ? handleVoters : undefined}
                />
              );
            })}
          </div>
        )}
      </main>

      <SurveyTypeSelectorModal
        open={showTypeSelector}
        onClose={() => setShowTypeSelector(false)}
      />
    </div>
  );
}
