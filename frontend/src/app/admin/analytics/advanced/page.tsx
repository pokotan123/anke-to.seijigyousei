'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { analyticsAPI, surveyAPI, questionAPI, authAPI } from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface Survey {
  id: number;
  title: string;
  questions: Question[];
}

interface Question {
  id: number;
  question_text: string;
  question_type: string;
}

interface CrosstabData {
  question_id1: number;
  question_id2: number;
  cross_tabulation: Array<{
    option1_id: number | null;
    option1_text: string | null;
    option2_id: number | null;
    option2_text: string | null;
    count: number;
  }>;
}

interface HeatmapData {
  survey_id: number;
  question_id: number;
  heatmap_data: Array<{
    hour: string;
    option_id: number | null;
    option_text: string | null;
    count: number;
  }>;
}

export default function AdvancedAnalyticsPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // クロス集計
  const [selectedQuestion1, setSelectedQuestion1] = useState<number | null>(null);
  const [selectedQuestion2, setSelectedQuestion2] = useState<number | null>(null);
  const [crosstabData, setCrosstabData] = useState<CrosstabData | null>(null);
  const [loadingCrosstab, setLoadingCrosstab] = useState(false);

  // ヒートマップ
  const [selectedHeatmapQuestion, setSelectedHeatmapQuestion] = useState<number | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);

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
        if (surveyData.length > 0) {
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
  }, [router]);

  useEffect(() => {
    if (selectedSurveyId) {
      loadQuestions();
    }
  }, [selectedSurveyId]);

  const loadQuestions = async () => {
    if (!selectedSurveyId) return;

    try {
      const data = await questionAPI.list(selectedSurveyId);
      setQuestions(data.filter((q: Question) => q.question_type !== 'text'));
    } catch (err: any) {
      console.error('Failed to load questions:', err);
    }
  };

  const handleCrosstabAnalysis = async () => {
    if (!selectedQuestion1 || !selectedQuestion2) {
      alert('2つの質問を選択してください');
      return;
    }

    if (selectedQuestion1 === selectedQuestion2) {
      alert('異なる質問を選択してください');
      return;
    }

    setLoadingCrosstab(true);
    try {
      const data = await analyticsAPI.getCrosstab(selectedQuestion1, selectedQuestion2);
      setCrosstabData(data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'クロス集計の取得に失敗しました');
    } finally {
      setLoadingCrosstab(false);
    }
  };

  const handleHeatmapAnalysis = async () => {
    if (!selectedSurveyId || !selectedHeatmapQuestion) {
      alert('アンケートと質問を選択してください');
      return;
    }

    setLoadingHeatmap(true);
    try {
      const data = await analyticsAPI.getHeatmap(selectedSurveyId, selectedHeatmapQuestion);
      setHeatmapData(data);
    } catch (err: any) {
      alert(err.response?.data?.error || 'ヒートマップデータの取得に失敗しました');
    } finally {
      setLoadingHeatmap(false);
    }
  };

  // ヒートマップ用データ変換
  const formatHeatmapData = () => {
    if (!heatmapData) return [];

    const hours = new Set<string>();
    const options = new Set<string>();
    const dataMap = new Map<string, number>();

    heatmapData.heatmap_data.forEach((item) => {
      const hour = new Date(item.hour).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
      const option = item.option_text || 'その他';
      hours.add(hour);
      options.add(option);
      dataMap.set(`${hour}-${option}`, item.count);
    });

    return Array.from(hours).map((hour) => {
      const row: any = { hour };
      Array.from(options).forEach((option) => {
        row[option] = dataMap.get(`${hour}-${option}`) || 0;
      });
      return row;
    });
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
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin/analytics')}
                className="text-blue-600 hover:text-blue-800"
              >
                ← 基本分析に戻る
              </button>
              <h1 className="text-xl font-bold text-gray-900">高度な分析</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  router.push('/admin/login');
                }}
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
          {/* アンケート選択 */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              アンケート選択
            </label>
            <select
              value={selectedSurveyId || ''}
              onChange={(e) => {
                setSelectedSurveyId(parseInt(e.target.value));
                setSelectedQuestion1(null);
                setSelectedQuestion2(null);
                setSelectedHeatmapQuestion(null);
                setCrosstabData(null);
                setHeatmapData(null);
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

          {/* クロス集計 */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">クロス集計分析</h2>
            <p className="text-sm text-gray-600 mb-4">
              2つの質問間の関連性を分析します
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  質問1
                </label>
                <select
                  value={selectedQuestion1 || ''}
                  onChange={(e) => setSelectedQuestion1(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">選択してください</option>
                  {questions.map((question) => (
                    <option key={question.id} value={question.id}>
                      {question.question_text}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  質問2
                </label>
                <select
                  value={selectedQuestion2 || ''}
                  onChange={(e) => setSelectedQuestion2(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">選択してください</option>
                  {questions.map((question) => (
                    <option key={question.id} value={question.id}>
                      {question.question_text}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleCrosstabAnalysis}
              disabled={loadingCrosstab || !selectedQuestion1 || !selectedQuestion2}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loadingCrosstab ? '分析中...' : '分析実行'}
            </button>

            {crosstabData && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">クロス集計結果</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          質問1
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          質問2
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          投票数
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {crosstabData.cross_tabulation.map((row, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.option1_text || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.option2_text || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {row.count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ヒートマップ */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">ヒートマップ分析</h2>
            <p className="text-sm text-gray-600 mb-4">
              時間帯と選択肢の関係を可視化します
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                質問選択
              </label>
              <select
                value={selectedHeatmapQuestion || ''}
                onChange={(e) => setSelectedHeatmapQuestion(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">選択してください</option>
                {questions.map((question) => (
                  <option key={question.id} value={question.id}>
                    {question.question_text}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleHeatmapAnalysis}
              disabled={loadingHeatmap || !selectedHeatmapQuestion}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loadingHeatmap ? '分析中...' : '分析実行'}
            </button>

            {heatmapData && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">ヒートマップ</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={formatHeatmapData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {heatmapData.heatmap_data
                      .reduce((acc: string[], item) => {
                        const option = item.option_text || 'その他';
                        if (!acc.includes(option)) {
                          acc.push(option);
                        }
                        return acc;
                      }, [])
                      .map((option, index) => {
                        const colors = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];
                        return (
                          <Bar
                            key={option}
                            dataKey={option}
                            stackId="a"
                            fill={colors[index % colors.length]}
                          />
                        );
                      })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

