'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { voteAPI, surveyAPI, authAPI } from '@/lib/api';

interface Vote {
  id: number;
  survey_id: number;
  question_id: number;
  option_id: number | null;
  answer_text: string | null;
  session_id: string;
  ip_address: string | null;
  voted_at: string;
}

interface Question {
  id: number;
  question_text: string;
}

interface Survey {
  id: number;
  title: string;
  questions?: Question[];
}

function VotesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterQuestionId, setFilterQuestionId] = useState<number | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/admin/login');
        return;
      }

      try {
        await authAPI.getMe();
        const surveyData = await surveyAPI.list();
        setSurveys(surveyData);
        
        const surveyIdParam = searchParams.get('survey_id');
        if (surveyIdParam) {
          setSelectedSurveyId(parseInt(surveyIdParam));
        } else if (surveyData.length > 0) {
          setSelectedSurveyId(surveyData[0].id);
        }
      } catch (err) {
        localStorage.removeItem('token');
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router, searchParams]);

  useEffect(() => {
    if (selectedSurveyId) {
      loadVotes();
      loadSurveyQuestions();
    }
  }, [selectedSurveyId, page, searchTerm, filterQuestionId, filterDateFrom, filterDateTo]);

  const loadSurveyQuestions = async () => {
    if (!selectedSurveyId) return;
    try {
      const surveyData = await surveyAPI.get(selectedSurveyId);
      setSurveys((prev) =>
        prev.map((s) => (s.id === selectedSurveyId ? { ...s, questions: surveyData.questions } : s))
      );
    } catch (err) {
      console.error('Failed to load questions:', err);
    }
  };

  const loadVotes = async () => {
    if (!selectedSurveyId) return;

    try {
      const data = await voteAPI.list(selectedSurveyId, limit, (page - 1) * limit, {
        questionId: filterQuestionId || undefined,
        search: searchTerm || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      });

      setVotes(data.votes);
      setTotal(data.total);
    } catch (err: any) {
      alert(err.response?.data?.error || '投票データの取得に失敗しました');
    }
  };

  const handleFilterReset = () => {
    setSearchTerm('');
    setFilterQuestionId(null);
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  };

  const handleExportCSV = async () => {
    if (!selectedSurveyId) {
      alert('アンケートを選択してください');
      return;
    }

    try {
      // 全データを取得（フィルター適用）
      const allData = await voteAPI.list(selectedSurveyId, 10000, 0, {
        questionId: filterQuestionId || undefined,
        search: searchTerm || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      });
      const allVotes = allData.votes;

      if (allVotes.length === 0) {
        alert('エクスポートするデータがありません');
        return;
      }

      const survey = surveys.find((s) => s.id === selectedSurveyId);
      const headers = ['ID', '質問ID', '選択肢ID', '回答テキスト', 'セッションID', 'IPアドレス', '投票日時'];
      const rows = allVotes.map((vote: Vote) => [
        vote.id,
        vote.question_id,
        vote.option_id || '',
        vote.answer_text || '',
        vote.session_id,
        vote.ip_address || '',
        new Date(vote.voted_at).toLocaleString('ja-JP'),
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map((row: (string | number)[]) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `votes_${survey?.title || selectedSurveyId}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.response?.data?.error || 'エクスポートに失敗しました');
    }
  };

  const handleExportExcel = async () => {
    if (!selectedSurveyId) {
      alert('アンケートを選択してください');
      return;
    }

    try {
      // 全データを取得（フィルター適用）
      const allData = await voteAPI.list(selectedSurveyId, 10000, 0, {
        questionId: filterQuestionId || undefined,
        search: searchTerm || undefined,
        dateFrom: filterDateFrom || undefined,
        dateTo: filterDateTo || undefined,
      });
      const allVotes = allData.votes;

      if (allVotes.length === 0) {
        alert('エクスポートするデータがありません');
        return;
      }

      const survey = surveys.find((s) => s.id === selectedSurveyId);
      
      // Excel形式（TSV形式で.xls拡張子）
      const headers = ['ID', '質問ID', '選択肢ID', '回答テキスト', 'セッションID', 'IPアドレス', '投票日時'];
      const rows = allVotes.map((vote: Vote) => [
        vote.id,
        vote.question_id,
        vote.option_id || '',
        vote.answer_text || '',
        vote.session_id,
        vote.ip_address || '',
        new Date(vote.voted_at).toLocaleString('ja-JP'),
      ]);

      // TSV形式（タブ区切り）
      const tsvContent = [
        headers.join('\t'),
        ...rows.map((row: (string | number)[]) => row.map((cell) => String(cell).replace(/\t/g, ' ')).join('\t')),
      ].join('\n');

      const blob = new Blob(['\uFEFF' + tsvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `votes_${survey?.title || selectedSurveyId}_${new Date().toISOString().split('T')[0]}.xls`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.response?.data?.error || 'エクスポートに失敗しました');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/admin/login');
  };

  const totalPages = Math.ceil(total / limit);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="text-blue-600 hover:text-blue-800"
              >
                ← 一覧に戻る
              </button>
              <h1 className="text-xl font-bold text-gray-900">投票データ管理</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-gray-800"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* フィルター */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    アンケート選択
                  </label>
                  <select
                    value={selectedSurveyId || ''}
                    onChange={(e) => {
                      setSelectedSurveyId(parseInt(e.target.value));
                      setPage(1);
                      handleFilterReset();
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {surveys.map((survey) => (
                      <option key={survey.id} value={survey.id}>
                        {survey.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <button
                    onClick={handleExportCSV}
                    disabled={votes.length === 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    CSV
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={votes.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Excel
                  </button>
                </div>
              </div>

              {/* 検索・フィルター */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    検索
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setPage(1);
                    }}
                    placeholder="回答、セッションID、IPで検索"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    質問でフィルター
                  </label>
                  <select
                    value={filterQuestionId || ''}
                    onChange={(e) => {
                      setFilterQuestionId(e.target.value ? parseInt(e.target.value) : null);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">すべて</option>
                    {surveys
                      .find((s) => s.id === selectedSurveyId)
                      ?.questions?.map((question) => (
                        <option key={question.id} value={question.id}>
                          {question.question_text}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    開始日
                  </label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => {
                      setFilterDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    終了日
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => {
                        setFilterDateTo(e.target.value);
                        setPage(1);
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleFilterReset}
                      className="px-3 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                      title="フィルターリセット"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 統計情報 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">総投票数</h3>
              <p className="text-3xl font-bold text-gray-900">{total}</p>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">表示中</h3>
              <p className="text-3xl font-bold text-gray-900">{votes.length}</p>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">ページ</h3>
              <p className="text-3xl font-bold text-gray-900">
                {page} / {totalPages || 1}
              </p>
            </div>
          </div>

          {/* 投票データ一覧 */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      質問ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      選択肢ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      回答
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      セッションID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IPアドレス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      投票日時
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {votes.map((vote) => (
                    <tr key={vote.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {vote.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {vote.question_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {vote.option_id || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {vote.answer_text || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vote.session_id.substring(0, 8)}...
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vote.ip_address || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(vote.voted_at).toLocaleString('ja-JP')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    前へ
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    次へ
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">{(page - 1) * limit + 1}</span> から{' '}
                      <span className="font-medium">{Math.min(page * limit, total)}</span> まで表示
                      （全 <span className="font-medium">{total}</span> 件）
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        前へ
                      </button>
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (page <= 3) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              page === pageNum
                                ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        次へ
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function VotesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">読み込み中...</div>}>
      <VotesPageContent />
    </Suspense>
  );
}

