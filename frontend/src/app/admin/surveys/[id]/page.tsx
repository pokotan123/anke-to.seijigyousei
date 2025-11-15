'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { surveyAPI, questionAPI, authAPI } from '../../../../lib/api';

interface Survey {
  id: number;
  title: string;
  description: string;
  status: string;
  unique_token: string;
  start_date: string | null;
  end_date: string | null;
  questions: Question[];
}

interface Question {
  id: number;
  question_text: string;
  question_type: 'single_choice' | 'multiple_choice' | 'text';
  order: number;
  is_required: boolean;
  options?: Option[];
}

interface Option {
  id: number;
  option_text: string;
  order: number;
}

export default function SurveyEditPage() {
  const router = useRouter();
  const params = useParams();
  const surveyId = parseInt(params.id as string);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingOption, setEditingOption] = useState<{ questionId: number; option: Option | null } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/admin/login');
        return;
      }

      try {
        await authAPI.getMe();
        await loadSurvey();
      } catch (err) {
        localStorage.removeItem('token');
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };

    if (surveyId) {
      checkAuth();
    }
  }, [surveyId, router]);

  const loadSurvey = async () => {
    const data = await surveyAPI.get(surveyId);
    setSurvey(data);
  };

  const handleSave = async () => {
    if (!survey) return;

    setSaving(true);
    try {
      await surveyAPI.update(surveyId, {
        title: survey.title,
        description: survey.description,
        status: survey.status,
        start_date: survey.start_date,
        end_date: survey.end_date,
      });
      alert('保存しました');
    } catch (err: any) {
      alert(err.response?.data?.error || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (!confirm('URLトークンを再発行しますか？旧URLは無効になります。')) {
      return;
    }

    try {
      const updated = await surveyAPI.regenerateToken(surveyId);
      if (updated) {
        setSurvey({ ...survey!, unique_token: updated.unique_token });
        alert('URLトークンを再発行しました');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || '再発行に失敗しました');
    }
  };

  const copyUrl = () => {
    if (!survey) return;
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/vote/${survey.unique_token}`;
    navigator.clipboard.writeText(url);
    alert('URLをコピーしました');
  };

  // 質問管理
  const handleAddQuestion = () => {
    setEditingQuestion({
      id: 0,
      question_text: '',
      question_type: 'single_choice',
      order: survey?.questions.length || 0,
      is_required: false,
      options: [],
    });
    setShowQuestionModal(true);
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion({ ...question });
    setShowQuestionModal(true);
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm('この質問を削除しますか？')) return;

    try {
      await questionAPI.delete(questionId);
      await loadSurvey();
      alert('質問を削除しました');
    } catch (err: any) {
      alert(err.response?.data?.error || '削除に失敗しました');
    }
  };

  const handleSaveQuestion = async () => {
    if (!editingQuestion || !survey) return;

    try {
      if (editingQuestion.id === 0) {
        // 新規作成
        await questionAPI.create({
          survey_id: surveyId,
          question_text: editingQuestion.question_text,
          question_type: editingQuestion.question_type,
          order: editingQuestion.order,
          is_required: editingQuestion.is_required,
        });
      } else {
        // 更新
        await questionAPI.update(editingQuestion.id, {
          question_text: editingQuestion.question_text,
          question_type: editingQuestion.question_type,
          order: editingQuestion.order,
          is_required: editingQuestion.is_required,
        });
      }
      await loadSurvey();
      setShowQuestionModal(false);
      setEditingQuestion(null);
      alert('質問を保存しました');
    } catch (err: any) {
      alert(err.response?.data?.error || '保存に失敗しました');
    }
  };

  // 選択肢管理
  const handleAddOption = (questionId: number) => {
    setEditingOption({ questionId, option: { id: 0, option_text: '', order: 0 } });
  };

  const handleEditOption = (questionId: number, option: Option) => {
    setEditingOption({ questionId, option: { ...option } });
  };

  const handleDeleteOption = async (optionId: number) => {
    if (!confirm('この選択肢を削除しますか？')) return;

    try {
      await questionAPI.deleteOption(optionId);
      await loadSurvey();
      alert('選択肢を削除しました');
    } catch (err: any) {
      alert(err.response?.data?.error || '削除に失敗しました');
    }
  };

  const handleSaveOption = async () => {
    if (!editingOption || !survey || !editingOption.option) return;

    try {
      if (editingOption.option.id === 0) {
        // 新規作成
        await questionAPI.createOption(editingOption.questionId, {
          option_text: editingOption.option.option_text,
          order: editingOption.option.order,
        });
      } else {
        // 更新
        await questionAPI.updateOption(editingOption.option.id, {
          option_text: editingOption.option.option_text,
          order: editingOption.option.order,
        });
      }
      await loadSurvey();
      setEditingOption(null);
      alert('選択肢を保存しました');
    } catch (err: any) {
      alert(err.response?.data?.error || '保存に失敗しました');
    }
  };

  // 質問の順序変更
  const handleMoveQuestion = async (questionId: number, direction: 'up' | 'down') => {
    if (!survey) return;

    const currentIndex = survey.questions.findIndex((q) => q.id === questionId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= survey.questions.length) return;

    const currentQuestion = survey.questions[currentIndex];
    const targetQuestion = survey.questions[newIndex];

    try {
      // 順序を入れ替え
      await questionAPI.update(currentQuestion.id, { order: targetQuestion.order });
      await questionAPI.update(targetQuestion.id, { order: currentQuestion.order });
      await loadSurvey();
    } catch (err: any) {
      alert(err.response?.data?.error || '順序の変更に失敗しました');
    }
  };

  // 選択肢の順序変更
  const handleMoveOption = async (questionId: number, optionId: number, direction: 'up' | 'down') => {
    if (!survey) return;

    const question = survey.questions.find((q) => q.id === questionId);
    if (!question || !question.options) return;

    const currentIndex = question.options.findIndex((o) => o.id === optionId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= question.options.length) return;

    const currentOption = question.options[currentIndex];
    const targetOption = question.options[newIndex];

    try {
      // 順序を入れ替え
      await questionAPI.updateOption(currentOption.id, { order: targetOption.order });
      await questionAPI.updateOption(targetOption.id, { order: currentOption.order });
      await loadSurvey();
    } catch (err: any) {
      alert(err.response?.data?.error || '順序の変更に失敗しました');
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

  if (!survey) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">アンケートが見つかりません</p>
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
              <h1 className="text-xl font-bold text-gray-900">アンケート編集</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">基本情報</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  タイトル
                </label>
                <input
                  type="text"
                  value={survey.title}
                  onChange={(e) => setSurvey({ ...survey, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  説明
                </label>
                <textarea
                  value={survey.description || ''}
                  onChange={(e) => setSurvey({ ...survey, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ステータス
                </label>
                <select
                  value={survey.status}
                  onChange={(e) => setSurvey({ ...survey, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="draft">下書き</option>
                  <option value="published">公開中</option>
                  <option value="closed">終了</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    開始日時
                  </label>
                  <input
                    type="datetime-local"
                    value={survey.start_date ? new Date(survey.start_date).toISOString().slice(0, 16) : ''}
                    onChange={(e) =>
                      setSurvey({
                        ...survey,
                        start_date: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    終了日時
                  </label>
                  <input
                    type="datetime-local"
                    value={survey.end_date ? new Date(survey.end_date).toISOString().slice(0, 16) : ''}
                    onChange={(e) =>
                      setSurvey({
                        ...survey,
                        end_date: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex space-x-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>

          {/* URL情報 */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">投票URL</h2>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/vote/${survey.unique_token}`}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
              <button
                onClick={copyUrl}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                コピー
              </button>
              <button
                onClick={handleRegenerateToken}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                再発行
              </button>
            </div>
          </div>

          {/* 質問一覧 */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">質問一覧</h2>
              <button
                onClick={handleAddQuestion}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                + 質問を追加
              </button>
            </div>
            <div className="space-y-4">
              {survey.questions.map((question, index) => (
                <div key={question.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {index + 1}. {question.question_text}
                        {question.is_required && <span className="text-red-500 ml-1">*</span>}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {question.question_type === 'single_choice' && '単一選択'}
                        {question.question_type === 'multiple_choice' && '複数選択'}
                        {question.question_type === 'text' && '自由記述'}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleMoveQuestion(question.id, 'up')}
                        disabled={index === 0}
                        className="px-2 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                        title="上に移動"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => handleMoveQuestion(question.id, 'down')}
                        disabled={index === survey.questions.length - 1}
                        className="px-2 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                        title="下に移動"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => handleEditQuestion(question)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(question.id)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                  {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') && (
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-medium text-gray-700">選択肢</h4>
                        <button
                          onClick={() => handleAddOption(question.id)}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          + 追加
                        </button>
                      </div>
                      <ul className="space-y-2">
                        {question.options && question.options.length > 0 ? (
                          question.options.map((option) => (
                            <li key={option.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm text-gray-600">{option.option_text}</span>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleMoveOption(question.id, option.id, 'up')}
                                  disabled={question.options?.findIndex((o) => o.id === option.id) === 0}
                                  className="px-1 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                                  title="上に移動"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => handleMoveOption(question.id, option.id, 'down')}
                                  disabled={
                                    question.options?.findIndex((o) => o.id === option.id) ===
                                    (question.options?.length || 0) - 1
                                  }
                                  className="px-1 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                                  title="下に移動"
                                >
                                  ↓
                                </button>
                                <button
                                  onClick={() => handleEditOption(question.id, option)}
                                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => handleDeleteOption(option.id)}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  削除
                                </button>
                              </div>
                            </li>
                          ))
                        ) : (
                          <li className="text-sm text-gray-400">選択肢がありません</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
              {survey.questions.length === 0 && (
                <p className="text-gray-500 text-center py-8">質問がありません。質問を追加してください。</p>
              )}
            </div>
          </div>

          {/* 質問編集モーダル */}
          {showQuestionModal && editingQuestion && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {editingQuestion.id === 0 ? '質問を追加' : '質問を編集'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      質問文 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={editingQuestion.question_text}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, question_text: e.target.value })
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      質問タイプ <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={editingQuestion.question_type}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          question_type: e.target.value as any,
                          options: e.target.value === 'text' ? [] : editingQuestion.options,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="single_choice">単一選択</option>
                      <option value="multiple_choice">複数選択</option>
                      <option value="text">自由記述</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingQuestion.is_required}
                        onChange={(e) =>
                          setEditingQuestion({ ...editingQuestion, is_required: e.target.checked })
                        }
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">必須質問</span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      表示順序
                    </label>
                    <input
                      type="number"
                      value={editingQuestion.order}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, order: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-6 flex space-x-4">
                  <button
                    onClick={handleSaveQuestion}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => {
                      setShowQuestionModal(false);
                      setEditingQuestion(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 選択肢編集モーダル */}
          {editingOption && editingOption.option && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-xl font-bold text-gray-900 mb-4">
                  {editingOption.option.id === 0 ? '選択肢を追加' : '選択肢を編集'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      選択肢テキスト <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editingOption.option.option_text}
                      onChange={(e) =>
                        setEditingOption({
                          ...editingOption,
                          option: { ...editingOption.option!, option_text: e.target.value },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      表示順序
                    </label>
                    <input
                      type="number"
                      value={editingOption.option.order}
                      onChange={(e) =>
                        setEditingOption({
                          ...editingOption,
                          option: { ...editingOption.option!, order: parseInt(e.target.value) || 0 },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-6 flex space-x-4">
                  <button
                    onClick={handleSaveOption}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setEditingOption(null)}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

