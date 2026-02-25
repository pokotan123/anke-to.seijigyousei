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
  linked_voting_survey_id: number | null;
  questions: Question[];
}

interface Question {
  id: number;
  question_text: string;
  question_type: 'single_choice' | 'multiple_choice' | 'text' | 'email';
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
  const [availableSurveys, setAvailableSurveys] = useState<Array<{id: number; title: string; status: string; linked_voting_survey_id: number | null}>>([]);

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
        const allSurveys = await surveyAPI.list();
        setAvailableSurveys(allSurveys);
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
        linked_voting_survey_id: survey.linked_voting_survey_id,
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
    const prefix = survey.linked_voting_survey_id ? 'register' : 'vote';
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/${prefix}/${survey.unique_token}`;
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

  const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800';
  const labelClass = 'block text-sm font-medium text-slate-600 mb-1.5';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <p className="text-sm text-slate-600">アンケートが見つかりません</p>
        </div>
      </div>
    );
  }

  const questionModalTitleId = 'question-modal-title';
  const optionModalTitleId = 'option-modal-title';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-4">
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="text-primary-600 hover:text-primary-700 text-sm cursor-pointer transition-colors"
            >
              ← 一覧に戻る
            </button>
            <h1 className="font-bold text-slate-800">アンケート編集</h1>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
        {/* 基本情報 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 mb-6">
          <h2 className="text-sm font-bold text-slate-800 mb-6">基本情報</h2>

          <div className="space-y-5">
            <div>
              <label htmlFor="title" className={labelClass}>タイトル <span className="text-red-500">*</span></label>
              <input
                id="title"
                type="text"
                value={survey.title}
                onChange={(e) => setSurvey({ ...survey, title: e.target.value })}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>説明</label>
              <textarea
                id="description"
                value={survey.description || ''}
                onChange={(e) => setSurvey({ ...survey, description: e.target.value })}
                rows={4}
                className={`${inputClass} resize-none leading-relaxed`}
              />
            </div>

            <div>
              <label htmlFor="status" className={labelClass}>ステータス</label>
              <select
                id="status"
                value={survey.status}
                onChange={(e) => setSurvey({ ...survey, status: e.target.value })}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="draft">下書き</option>
                <option value="published">公開中</option>
                <option value="closed">終了</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className={labelClass}>開始日時</label>
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
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="endDate" className={labelClass}>終了日時</label>
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
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* メール認証投票設定 */}
          <div className="border-t border-slate-100 pt-6 mt-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">メール認証投票設定</h3>

            <label className="flex items-center gap-2.5 cursor-pointer mb-4">
              <input
                type="checkbox"
                id="require_registration"
                checked={survey.require_registration || false}
                onChange={(e) => setSurvey({ ...survey, require_registration: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded border-slate-300 cursor-pointer"
              />
              <span className="text-sm text-slate-600">メール登録を必須にする</span>
            </label>

            {survey.require_registration && (
              <div className="ml-6 space-y-4 border-l-2 border-primary-100 pl-4">
                <div>
                  <label htmlFor="registrationMessage" className={labelClass}>登録案内メッセージ</label>
                  <textarea
                    id="registrationMessage"
                    value={survey.registration_message || ''}
                    onChange={(e) => setSurvey({ ...survey, registration_message: e.target.value })}
                    className={`${inputClass} resize-none leading-relaxed`}
                    rows={3}
                    placeholder="投票に参加するにはメールアドレスの登録が必要です。"
                  />
                </div>
                <div>
                  <label htmlFor="registrationDeadline" className={labelClass}>登録締め切り日時</label>
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
                    className={inputClass}
                  />
                </div>
                {/* カスタム登録項目 */}
                <div>
                  <label className={labelClass}>登録フォームの入力項目</label>
                  <p className="text-xs text-slate-400 mb-3">メールアドレスに加えて、投票者に入力してもらう項目を設定できます。</p>
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
                          className={`flex-1 ${inputClass}`}
                          placeholder="項目名（例: 学校名）"
                        />
                        <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={field.required || false}
                            onChange={(e) => {
                              const fields = [...(survey.registration_fields || [])];
                              fields[index] = { ...fields[index], required: e.target.checked };
                              setSurvey({ ...survey, registration_fields: fields });
                            }}
                            className="h-3.5 w-3.5 cursor-pointer"
                          />必須
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const fields = (survey.registration_fields || []).filter((_, i) => i !== index);
                            setSurvey({ ...survey, registration_fields: fields });
                          }}
                          className="text-red-500 hover:text-red-600 text-xs px-2 py-1 cursor-pointer transition-colors"
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
                    className="text-xs text-primary-600 hover:text-primary-700 py-1 cursor-pointer transition-colors"
                  >
                    + 項目を追加
                  </button>
                </div>
                {survey.id && (
                  <div className="mt-4">
                    <a
                      href={`/admin/surveys/${survey.id}/voters`}
                      className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      投票者管理画面へ →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 紐づけ登録アンケート設定（投票アンケートの場合のみ表示） */}
          {!survey.linked_voting_survey_id && (
          <div className="border-t border-slate-100 pt-6 mt-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">紐づけ登録アンケート</h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              この投票アンケートに紐づける登録アンケートを選択してください。登録アンケートで参加者情報を収集し、投票リンクを発行します。
            </p>
            <div>
              <label htmlFor="linkedRegistration" className={labelClass}>登録アンケート</label>
              <select
                id="linkedRegistration"
                value={
                  availableSurveys.find((s) => s.linked_voting_survey_id === survey.id)?.id ?? ''
                }
                onChange={async (e) => {
                  const newRegId = e.target.value ? parseInt(e.target.value) : null;
                  const currentReg = availableSurveys.find((s) => s.linked_voting_survey_id === survey.id);
                  try {
                    // 既存の紐づけを解除
                    if (currentReg) {
                      await surveyAPI.update(currentReg.id, { linked_voting_survey_id: null });
                    }
                    // 新しい紐づけを設定
                    if (newRegId) {
                      await surveyAPI.update(newRegId, { linked_voting_survey_id: survey.id });
                    }
                    // リスト更新
                    const allSurveys = await surveyAPI.list();
                    setAvailableSurveys(allSurveys);
                  } catch (err: any) {
                    alert(err.response?.data?.error || '紐づけの変更に失敗しました');
                  }
                }}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">なし</option>
                {availableSurveys
                  .filter((s) => s.id !== survey.id && (!s.linked_voting_survey_id || s.linked_voting_survey_id === survey.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
              </select>
              {availableSurveys.find((s) => s.linked_voting_survey_id === survey.id) && (
                <p className="text-xs text-primary-600 mt-2 leading-relaxed">
                  登録アンケートが紐づけられています。登録アンケートにはメールアドレス（email）タイプの質問が必要です。
                </p>
              )}
            </div>
          </div>
          )}

          {/* 登録アンケートの場合：紐づけ先情報を表示 */}
          {survey.linked_voting_survey_id && (
          <div className="border-t border-slate-100 pt-6 mt-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4">紐づけ先投票アンケート</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              このアンケートは登録用です。紐づけ先: {availableSurveys.find((s) => s.id === survey.linked_voting_survey_id)?.title || `ID: ${survey.linked_voting_survey_id}`}
            </p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              紐づけの変更は投票アンケートの編集画面から行ってください。
            </p>
          </div>
          )}

          <div className="flex gap-3 pt-6 mt-6 border-t border-slate-100">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer transition-colors"
            >
              {saving ? '保存中...' : '保存'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/dashboard')}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>

        {/* URL情報 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 mb-6">
          <h2 className="text-sm font-bold text-slate-800 mb-4">
            {survey.linked_voting_survey_id ? '登録URL' : '投票URL'}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/${survey.linked_voting_survey_id ? 'register' : 'vote'}/${survey.unique_token}`}
              className="flex-1 min-w-0 px-3 py-2.5 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-600 font-mono"
            />
            <button
              onClick={copyUrl}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
            >
              コピー
            </button>
            <button
              onClick={handleRegenerateToken}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
            >
              再発行
            </button>
          </div>
        </div>

        {/* 質問一覧 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-bold text-slate-800">質問一覧</h2>
            <button
              onClick={handleAddQuestion}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              質問を追加
            </button>
          </div>
          <div className="space-y-4">
            {survey.questions.map((question, index) => (
              <div key={question.id} className="border border-slate-200 rounded-xl p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-bold shrink-0">{index + 1}</span>
                      <h3 className="font-semibold text-slate-800 text-sm">
                        {question.question_text}
                        {question.is_required && <span className="text-red-500 ml-1">*</span>}
                      </h3>
                    </div>
                    <span className="text-xs text-slate-400 ml-8">
                      {question.question_type === 'single_choice' && '単一選択'}
                      {question.question_type === 'multiple_choice' && '複数選択'}
                      {question.question_type === 'text' && '自由記述'}
                      {question.question_type === 'email' && 'メールアドレス'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <button
                      onClick={() => handleMoveQuestion(question.id, 'up')}
                      disabled={index === 0}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-30 cursor-pointer transition-colors"
                      aria-label="質問を上に移動"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMoveQuestion(question.id, 'down')}
                      disabled={index === survey.questions.length - 1}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-30 cursor-pointer transition-colors"
                      aria-label="質問を下に移動"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEditQuestion(question)}
                      className="px-2.5 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-md border border-primary-200 cursor-pointer transition-colors"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(question.id)}
                      className="px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-md border border-red-200 cursor-pointer transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
                {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') && (
                  <div className="mt-4 ml-8">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-xs font-medium text-slate-500">選択肢</h4>
                      <button
                        onClick={() => handleAddOption(question.id)}
                        className="text-xs text-primary-600 hover:text-primary-700 cursor-pointer transition-colors"
                      >
                        + 追加
                      </button>
                    </div>
                    <ul className="space-y-2">
                      {question.options && question.options.length > 0 ? (
                        question.options.map((option) => (
                          <li key={option.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                            <span className="text-sm text-slate-700">{option.option_text}</span>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <button
                                onClick={() => handleMoveOption(question.id, option.id, 'up')}
                                disabled={question.options?.findIndex((o) => o.id === option.id) === 0}
                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer transition-colors"
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
                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded disabled:opacity-30 cursor-pointer transition-colors"
                                aria-label="選択肢を下に移動"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleEditOption(question.id, option)}
                                className="px-2 py-1 text-xs text-primary-600 hover:bg-primary-50 rounded cursor-pointer transition-colors"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDeleteOption(option.id)}
                                className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded cursor-pointer transition-colors"
                              >
                                削除
                              </button>
                            </div>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-slate-400 py-3 text-center">選択肢がありません</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            {survey.questions.length === 0 && (
              <div className="text-center py-12">
                <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <p className="text-sm text-slate-400">質問がありません</p>
                <p className="text-xs text-slate-400 mt-1">上のボタンから質問を追加してください</p>
              </div>
            )}
          </div>
        </div>

        {/* 質問編集モーダル */}
        {showQuestionModal && editingQuestion && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeQuestionModal();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={questionModalTitleId}
          >
            <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
              <h3 id={questionModalTitleId} className="text-lg font-bold text-slate-800 mb-5">
                {editingQuestion.id === 0 ? '質問を追加' : '質問を編集'}
              </h3>
              <div className="space-y-5">
                <div>
                  <label htmlFor="questionText" className={labelClass}>
                    質問文 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="questionText"
                    value={editingQuestion.question_text}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, question_text: e.target.value })
                    }
                    rows={3}
                    className={`${inputClass} resize-none leading-relaxed`}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="questionType" className={labelClass}>
                    質問タイプ <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="questionType"
                    value={editingQuestion.question_type}
                    onChange={(e) =>
                      setEditingQuestion({
                        ...editingQuestion,
                        question_type: e.target.value as any,
                        options: (e.target.value === 'text' || e.target.value === 'email') ? [] : editingQuestion.options,
                      })
                    }
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="single_choice">単一選択</option>
                    <option value="multiple_choice">複数選択</option>
                    <option value="text">自由記述</option>
                    <option value="email">メールアドレス</option>
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingQuestion.is_required}
                      onChange={(e) =>
                        setEditingQuestion({ ...editingQuestion, is_required: e.target.checked })
                      }
                      className="w-4 h-4 text-primary-600 rounded border-slate-300 cursor-pointer"
                    />
                    <span className="text-sm text-slate-600">必須質問</span>
                  </label>
                </div>
                <div>
                  <label htmlFor="questionOrder" className={labelClass}>表示順序</label>
                  <input
                    id="questionOrder"
                    type="number"
                    value={editingQuestion.order}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, order: parseInt(e.target.value) || 0 })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveQuestion}
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 cursor-pointer transition-colors"
                >
                  保存
                </button>
                <button
                  onClick={closeQuestionModal}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeOptionModal();
              }
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={optionModalTitleId}
          >
            <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-md animate-fade-in">
              <h3 id={optionModalTitleId} className="text-lg font-bold text-slate-800 mb-5">
                {editingOption.option.id === 0 ? '選択肢を追加' : '選択肢を編集'}
              </h3>
              <div className="space-y-5">
                <div>
                  <label htmlFor="optionText" className={labelClass}>
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
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="optionOrder" className={labelClass}>表示順序</label>
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
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSaveOption}
                  className="flex-1 px-4 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 cursor-pointer transition-colors"
                >
                  保存
                </button>
                <button
                  onClick={closeOptionModal}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
