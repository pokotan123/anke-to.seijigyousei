'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { analyticsAPI, surveyAPI, authAPI } from '@/lib/api';
import { io, Socket } from 'socket.io-client';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface AnalyticsData {
  survey_id: number;
  survey_title: string;
  total_votes: number;
  questions: Array<{
    question_id: number;
    question_text: string;
    question_type: string;
    aggregates: Array<{
      option_id: number | null;
      option_text: string | null;
      count: number;
      percentage: number;
    }>;
  }>;
  time_series: Array<{
    hour: string;
    count: number;
  }>;
  updated_at: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export default function AnalyticsPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // 秒

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
    if (!selectedSurveyId) return;

    const fetchAnalytics = async () => {
      try {
        const data = await analyticsAPI.getRealtime(selectedSurveyId);
        setAnalyticsData(data);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
      }
    };

    fetchAnalytics();

    // Socket.io接続
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const newSocket = io(wsUrl, {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      newSocket.emit('subscribe:survey', selectedSurveyId);
    });

    newSocket.on('survey:update', (data: any) => {
      console.log('Survey update received:', data);
      fetchAnalytics();
    });

    newSocket.on('survey:data', (data: any) => {
      setAnalyticsData(data);
    });

    setSocket(newSocket);

    // 自動更新
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(fetchAnalytics, refreshInterval * 1000);
    }

    return () => {
      newSocket.disconnect();
      if (interval) clearInterval(interval);
    };
  }, [selectedSurveyId, autoRefresh, refreshInterval]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/admin/login');
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
              <h1 className="text-xl font-bold text-gray-900">分析ダッシュボード</h1>
              <Link href="/admin/dashboard" className="text-blue-600 hover:text-blue-800">
                アンケート一覧
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/admin/analytics/advanced"
                className="text-blue-600 hover:text-blue-800"
              >
                高度な分析
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
          {/* コントロールパネル */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  アンケート選択
                </label>
                <select
                  value={selectedSurveyId || ''}
                  onChange={(e) => setSelectedSurveyId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {surveys.map((survey) => (
                    <option key={survey.id} value={survey.id}>
                      {survey.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="autoRefresh"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="autoRefresh" className="text-sm text-gray-700">
                  自動更新
                </label>
              </div>
              {autoRefresh && (
                <div>
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value={1}>1秒</option>
                    <option value={5}>5秒</option>
                    <option value={10}>10秒</option>
                    <option value={30}>30秒</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {analyticsData && (
            <>
              {/* サマリー */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">総投票数</h3>
                  <p className="text-3xl font-bold text-gray-900">{analyticsData.total_votes}</p>
                </div>
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">質問数</h3>
                  <p className="text-3xl font-bold text-gray-900">{analyticsData.questions.length}</p>
                </div>
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">最終更新</h3>
                  <p className="text-sm text-gray-900">
                    {new Date(analyticsData.updated_at).toLocaleString('ja-JP')}
                  </p>
                </div>
              </div>

              {/* 時系列グラフ */}
              {analyticsData.time_series.length > 0 && (
                <div className="bg-white shadow rounded-lg p-6 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">投票推移</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData.time_series}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="hour"
                        tickFormatter={(value) => new Date(value).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleString('ja-JP')}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#0088FE"
                        strokeWidth={2}
                        name="投票数"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* 質問別の集計 */}
              <div className="space-y-6">
                {analyticsData.questions.map((question) => (
                  <div key={question.question_id} className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {question.question_text}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* 円グラフ */}
                      {question.aggregates.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">分布</h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={question.aggregates}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) =>
                                  `${name}: ${(percent * 100).toFixed(0)}%`
                                }
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="count"
                              >
                                {question.aggregates.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                  />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* 棒グラフ */}
                      {question.aggregates.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">投票数</h4>
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={question.aggregates}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                dataKey="option_text"
                                angle={-45}
                                textAnchor="end"
                                height={100}
                              />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="count" fill="#0088FE" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}

                      {/* テーブル表示 */}
                      <div className="md:col-span-2">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">詳細データ</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  選択肢
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  投票数
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  割合
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {question.aggregates.map((aggregate, index) => (
                                <tr key={index}>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {aggregate.option_text || '自由記述'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {aggregate.count}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {typeof aggregate.percentage === 'number' 
                                      ? aggregate.percentage.toFixed(2) 
                                      : parseFloat(aggregate.percentage || '0').toFixed(2)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!analyticsData && selectedSurveyId && (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <p className="text-gray-500">データを読み込み中...</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Link({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  const router = useRouter();
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        router.push(href);
      }}
      className={className}
    >
      {children}
    </a>
  );
}

