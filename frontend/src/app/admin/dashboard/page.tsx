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
}

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
    
    if (!confirm(`「${surveyTitle}」を削除しますか？\nこの操作は取り消せません。`)) {
      return;
    }

    try {
      await surveyAPI.delete(surveyId);
      alert('アンケートを削除しました');
      // リストを再読み込み
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
      
      // blobが空でないことを確認
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
    } catch (err: any) {
      console.error('CSV export error:', err);
      let errorMessage = 'CSVエクスポートに失敗しました';
      
      if (err.response?.data) {
        if (err.response.data instanceof Blob) {
          // blobエラーの場合、テキストとして読み取る
          const text = await err.response.data.text();
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = text || errorMessage;
          }
        } else if (typeof err.response.data === 'object' && err.response.data.error) {
          errorMessage = err.response.data.error;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      alert(errorMessage);
    }
  };

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
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">管理画面</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/admin/analytics"
                className="text-blue-600 hover:text-blue-800"
              >
                分析ダッシュボード
              </Link>
              <Link
                href="/admin/votes"
                className="text-blue-600 hover:text-blue-800"
              >
                投票データ
              </Link>
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
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">アンケート一覧</h2>
            <Link
              href="/admin/surveys/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              新規作成
            </Link>
          </div>

          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {surveys.map((survey) => (
                <li key={survey.id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <Link href={`/admin/surveys/${survey.id}`} className="flex-1">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {survey.title}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            ステータス: {survey.status} | 
                            トークン: {survey.unique_token}
                          </p>
                          <p className="mt-1 text-sm text-gray-500">
                            投票URL: {typeof window !== 'undefined' && `${window.location.origin}/vote/${survey.unique_token}`}
                          </p>
                        </div>
                      </Link>
                      <div className="ml-4 flex items-center space-x-2">
                        <span className="text-sm text-gray-500">
                          {new Date(survey.created_at).toLocaleDateString('ja-JP')}
                        </span>
                        <button
                          onClick={(e) => handleExportCSV(survey.id, survey.title, e)}
                          className="px-3 py-1 text-sm text-green-600 hover:text-green-800 hover:bg-green-50 rounded border border-green-300 transition"
                          title="CSVダウンロード"
                        >
                          CSV
                        </button>
                        <button
                          onClick={(e) => handleDelete(survey.id, survey.title, e)}
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-red-300 transition"
                          title="削除"
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

