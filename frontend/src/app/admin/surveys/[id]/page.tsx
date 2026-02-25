'use client';

import { useEffect, useState, useCallback } from 'react';
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
  require_registration: boolean;
  registration_message: string;
  registration_deadline: string | null;
  registration_fields?: { name: string; required: boolean }[];
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

  const closeQuestionModal = useCallback(() => {
    setShowQuestionModal(false);
    setEditingQuestion(null);
  }, []);

  const closeOptionModal = useCallback(() => {
    setEditingOption(null);
  }, []);

  // モーダルのEscキー対応
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingOption) {
          closeOptionModal();
        } else if (showQuestionModal) {
          closeQuestionModal();
        }
      }
    };

    if (showQuestionModal || editingOption) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showQuestionModal, editingOption, closeQuestionModal, closeOptionModal]);

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
        require_registration: survey.require_registration,
        registration_message: survey.registration_message,
        registration_deadline: survey.registration_deadline,
        registration_fields: (survey.registration_fields || []).filter((f) => f.name.trim() !== ''),
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

  const questionModalTitleId = 'question-modal-title';
  const optionModalTitleId = 'option-modal-title';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors duration-200 py-2 px-1"
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
            <h2 className="text-lg font-semibold text-gray-900 mb-6">基本情報</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  タイトル
                </label>
                <input
                  id="title"
                  type="text"
                  value={survey.title}
                  onChange={(e) => setSurvey({ ...survey, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  説明
                </label>
                <textarea
                  id="description"
                  value={survey.description || ''}
                  onChange={(e) => setSurvey({ ...survey, description: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                  ステータス
                </label>
                <select
                  id="status"
                  value={survey.status}
                  onChange={(e) => setSurvey({ ...survey, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="draft">下書き</option>
                  <option value="published">公開中</option>
                  <option value="closed">終了</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                    開始日時
                  </label>
                  <input
                    id="startDate"
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
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                    終了日時
                  </label>
                  <input
                    id="endDate"
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

            {/* メール認証投票設定 */}
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">メール認証投票設定</h3>

              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  id="require_registration"
                  checked={survey.require_registration || false}
                  onChange={(e) => setSurvey({ ...survey, require_registration: e.target.checked })}
                  className="h-4 w-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                />
                <label htmlFor="require_registration" className="text-sm font-medium text-gray-700">
                  メール登録を必須にする
                </label>
              </div>

              {survey.require_registration && (
                <div className="ml-7 space-y-4">
                  <div>
                    <label htmlFor="registrationMessage" className="block text-sm font-medium text-gray-700 mb-1">
                      登録案内メッセージ
                    </label>
                    <textarea
                      id="registrationMessage"
                      value={survey.registration_message || ''}
                      onChange={(e) => setSurvey({ ...survey, registration_message: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 leading-relaxed"
                      rows={3}
                      placeholder="投票に参加するにはメールアドレスの登録が必要です。"
                    />
                  </div>
                  <div>
                    <label htmlFor="registrationDeadline" className="block text-sm font-medium text-gray-700 mb-1">
                      登録締め切り日時
                    </label>
                    <input
                      id="registrationDeadline"
                      type="datetime-local"
                      value={survey.registration_deadline ? new Date(survey.registration_deadline).toISOString().slice(0, 16) : ''}
                      onChange={(e) =>
                        setSurvey({
                          ...survey,
                          registration_deadline: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {/* カスタム登録項目 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      登録フォームの入力項目
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      メールアドレスに加えて、投票者に入力してもらう項目を設定できます。
                    </p>
                    <div className="space-y-2 mb-3">
                      {(survey.registration_fields || []).map((field, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={field.name}
                            onChange={(e) => {
                              const fields = [...(survey.registration_fields || [])];
                              fields[index] = { ...fields[index], name: e.target.value };
                              setSurvey({ ...survey, registration_fields: fields });
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                            placeholder="項目名（例: 学校名）"
                          />
                          <label className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={field.required || false}
                              onChange={(e) => {
                                const fields = [...(survey.registration_fields || [])];
                                fields[index] = { ...fields[index], required: e.target.checked };
                                setSurvey({ ...survey, registration_fields: fields });
                              }}
                              className="h-3.5 w-3.5 cursor-pointer"
                            />
                            必須
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const fields = (survey.registration_fields || []).filter((_, i) => i !== index);
                              setSurvey({ ...survey, registration_fields: fields });
                            }}
                            className="text-red-500 hover:text-red-700 text-sm py-1.5 px-3 cursor-pointer transition-colors duration-200"
                          >
                            削除
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const fields = [...(survey.registration_fields || []), { name: '', required: false }];
                        setSurvey({ ...survey, registration_fields: fields });
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 py-2 px-3 cursor-pointer transition-colors duration-200"
                    >
                      + 項目を追加
                    </button>
                  </div>
                  {survey.id && (
                    <div className="mt-4">
                      <a
                        href={`/admin/surveys/${survey.id}/voters`}
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200"
                      >
                        投票者管理画面へ →
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex space-x-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors duration-200"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>

          {/* URL情報 */}
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">投票URL</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/vote/${survey.unique_token}`}
                className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
              <button
                onClick={copyUrl}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 cursor-pointer transition-colors duration-200"
              >
                コピー
              </button>
              <button
                onClick={handleRegenerateToken}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 cursor-pointer transition-colors duration-200"
              >
                再発行
              </button>
            </div>
          </div>

          {/* 質問一覧 */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">質問一覧</h2>
              <button
                onClick={handleAddQuestion}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors duration-200"
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
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleMoveQuestion(question.id, 'up')}
                        disabled={index === 0}
                        className="p-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 cursor-pointer transition-colors duration-200"
                        aria-label="質問を上に移動"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleMoveQuestion(question.id, 'down')}
                        disabled={index === survey.questions.length - 1}
                        className="p-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 cursor-pointer transition-colors duration-200"
                        aria-label="質問を下に移動"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleEditQuestion(question)}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-colors duration-200"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(question.id)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer transition-colors duration-200"
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
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer transition-colors duration-200"
                        >
                          + 追加
                        </button>
                      </div>
                      <ul className="space-y-2">
                        {question.options && question.options.length > 0 ? (
                          question.options.map((option) => (
                            <li key={option.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm text-gray-600">{option.option_text}</span>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => handleMoveOption(question.id, option.id, 'up')}
                                  disabled={question.options?.findIndex((o) => o.id === option.id) === 0}
                                  className="p-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 cursor-pointer transition-colors duration-200"
                                  aria-label="選択肢を上に移動"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleMoveOption(question.id, option.id, 'down')}
                                  disabled={
                                    question.options?.findIndex((o) => o.id === option.id) ===
                                    (question.options?.length || 0) - 1
                                  }
                                  className="p-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50 cursor-pointer transition-colors duration-200"
                                  aria-label="選択肢を下に移動"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleEditOption(question.id, option)}
                                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-colors duration-200"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => handleDeleteOption(option.id)}
                                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer transition-colors duration-200"
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
                <p className="text-gray-500 text-center py-8 leading-relaxed">質問がありません。質問を追加してください。</p>
              )}
            </div>
          </div>

          {/* 質問編集モーダル */}
          {showQuestionModal && editingQuestion && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  closeQuestionModal();
                }
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={questionModalTitleId}
            >
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h3 id={questionModalTitleId} className="text-lg font-semibold text-gray-900 mb-4">
                  {editingQuestion.id === 0 ? '質問を追加' : '質問を編集'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="questionText" className="block text-sm font-medium text-gray-700 mb-2">
                      質問文 <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="questionText"
                      value={editingQuestion.question_text}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, question_text: e.target.value })
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 leading-relaxed"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="questionType" className="block text-sm font-medium text-gray-700 mb-2">
                      質問タイプ <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="questionType"
                      value={editingQuestion.question_type}
                      onChange={(e) =>
                        setEditingQuestion({
                          ...editingQuestion,
                          question_type: e.target.value as any,
                          options: e.target.value === 'text' ? [] : editingQuestion.options,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="single_choice">単一選択</option>
                      <option value="multiple_choice">複数選択</option>
                      <option value="text">自由記述</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingQuestion.is_required}
                        onChange={(e) =>
                          setEditingQuestion({ ...editingQuestion, is_required: e.target.checked })
                        }
                        className="mr-2 cursor-pointer"
                      />
                      <span className="text-sm text-gray-700">必須質問</span>
                    </label>
                  </div>
                  <div>
                    <label htmlFor="questionOrder" className="block text-sm font-medium text-gray-700 mb-2">
                      表示順序
                    </label>
                    <input
                      id="questionOrder"
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
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors duration-200"
                  >
                    保存
                  </button>
                  <button
                    onClick={closeQuestionModal}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 cursor-pointer transition-colors duration-200"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 選択肢編集モーダル */}
          {editingOption && editingOption.option && (
            <div
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  closeOptionModal();
                }
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={optionModalTitleId}
            >
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 id={optionModalTitleId} className="text-lg font-semibold text-gray-900 mb-4">
                  {editingOption.option.id === 0 ? '選択肢を追加' : '選択肢を編集'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="optionText" className="block text-sm font-medium text-gray-700 mb-2">
                      選択肢テキスト <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="optionText"
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
                    <label htmlFor="optionOrder" className="block text-sm font-medium text-gray-700 mb-2">
                      表示順序
                    </label>
                    <input
                      id="optionOrder"
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
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors duration-200"
                  >
                    保存
                  </button>
                  <button
                    onClick={closeOptionModal}
                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 cursor-pointer transition-colors duration-200"
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
