'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { surveyAPI, questionAPI } from '../../../../../lib/api';

type QuestionType = 'single_choice' | 'multiple_choice' | 'text' | 'email';

interface LocalQuestion {
  tempId: number;
  question_text: string;
  question_type: QuestionType;
  is_required: boolean;
  options: string[];
}

interface NewQuestionForm {
  question_text: string;
  question_type: QuestionType;
  is_required: boolean;
  options: string[];
  optionInput: string;
}

const INITIAL_NEW_QUESTION: NewQuestionForm = {
  question_text: '',
  question_type: 'text',
  is_required: false,
  options: [],
  optionInput: '',
};

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: '単一選択',
  multiple_choice: '複数選択',
  text: 'テキスト',
  email: 'メール',
};

const isChoiceType = (t: QuestionType): boolean =>
  t === 'single_choice' || t === 'multiple_choice';

const DEFAULT_EMAIL_QUESTION: LocalQuestion = {
  tempId: 0,
  question_text: 'メールアドレス',
  question_type: 'email',
  is_required: true,
  options: [],
};

export default function NewRegistrationSurveyPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<LocalQuestion[]>([DEFAULT_EMAIL_QUESTION]);
  const [newQuestion, setNewQuestion] = useState<NewQuestionForm>(INITIAL_NEW_QUESTION);
  const [nextTempId, setNextTempId] = useState(1);
  const [saving, setSaving] = useState(false);

  const updateNewQuestion = useCallback(
    (patch: Partial<NewQuestionForm>) =>
      setNewQuestion((prev) => ({ ...prev, ...patch })),
    []
  );

  const handleAddOption = useCallback(() => {
    const trimmed = newQuestion.optionInput.trim();
    if (!trimmed) return;
    updateNewQuestion({
      options: [...newQuestion.options, trimmed],
      optionInput: '',
    });
  }, [newQuestion.optionInput, newQuestion.options, updateNewQuestion]);

  const handleRemoveOption = useCallback(
    (index: number) =>
      setNewQuestion((prev) => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index),
      })),
    []
  );

  const handleAddQuestion = useCallback(() => {
    if (!newQuestion.question_text.trim()) return;
    if (isChoiceType(newQuestion.question_type) && newQuestion.options.length === 0) {
      alert('選択肢を1つ以上追加してください');
      return;
    }
    const added: LocalQuestion = {
      tempId: nextTempId,
      question_text: newQuestion.question_text.trim(),
      question_type: newQuestion.question_type,
      is_required: newQuestion.is_required,
      options: isChoiceType(newQuestion.question_type) ? [...newQuestion.options] : [],
    };
    setQuestions((prev) => [...prev, added]);
    setNextTempId((id) => id + 1);
    setNewQuestion(INITIAL_NEW_QUESTION);
  }, [newQuestion, nextTempId]);

  const handleDeleteQuestion = useCallback(
    (tempId: number) =>
      setQuestions((prev) => prev.filter((q) => q.tempId !== tempId)),
    []
  );

  const handleSave = async () => {
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }
    setSaving(true);
    try {
      const survey = await surveyAPI.create({
        title: title.trim(),
        description: description.trim() || null,
        status: 'draft',
        linked_voting_survey_id: null,
      });

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const created = await questionAPI.create({
          survey_id: survey.id,
          question_text: q.question_text,
          question_type: q.question_type,
          order: i + 1,
          is_required: q.is_required,
        });

        if (isChoiceType(q.question_type)) {
          for (let j = 0; j < q.options.length; j++) {
            await questionAPI.createOption(created.id, {
              option_text: q.options[j],
              order: j + 1,
            });
          }
        }
      }

      router.push(`/admin/surveys/${survey.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '保存に失敗しました';
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800';
  const labelClass = 'block text-sm font-medium text-slate-600 mb-1.5';

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-4">
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="text-primary-600 hover:text-primary-700 text-sm cursor-pointer transition-colors"
            >
              ← 登録アンケート新規作成
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
        {/* 基本情報 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 mb-6">
          <h2 className="text-sm font-bold text-slate-800 mb-4">基本情報</h2>
          <div className="space-y-5">
            <div>
              <label htmlFor="title" className={labelClass}>
                タイトル <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
                placeholder="例: 第1回公開討論会 参加登録"
                required
              />
            </div>
            <div>
              <label htmlFor="description" className={labelClass}>
                説明
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={`${inputClass} resize-none leading-relaxed`}
                placeholder="登録アンケートの説明（任意）"
              />
            </div>
          </div>
        </div>

        {/* 質問管理 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 mb-6">
          <h2 className="text-sm font-bold text-slate-800 mb-4">質問管理</h2>

          {/* 既存質問一覧 */}
          <div className="space-y-3 mb-6">
            {questions.map((q, index) => {
              const isEmail = q.tempId === 0;
              return (
                <div
                  key={q.tempId}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50/50"
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 font-medium truncate">
                      {q.question_text}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-slate-200 text-slate-600">
                        {TYPE_LABELS[q.question_type]}
                      </span>
                      {q.is_required && (
                        <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-red-50 text-red-600 border border-red-200">
                          必須
                        </span>
                      )}
                    </div>
                    {q.options.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        選択肢: {q.options.join(', ')}
                      </p>
                    )}
                  </div>
                  {!isEmail && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.tempId)}
                        className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded cursor-pointer transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  )}
                  {isEmail && (
                    <span className="text-xs text-slate-400 shrink-0 mt-1">
                      固定
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 新規質問追加フォーム */}
          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              質問を追加
            </h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="newQuestionText" className={labelClass}>
                  質問文
                </label>
                <textarea
                  id="newQuestionText"
                  value={newQuestion.question_text}
                  onChange={(e) =>
                    updateNewQuestion({ question_text: e.target.value })
                  }
                  rows={2}
                  className={`${inputClass} resize-none leading-relaxed`}
                  placeholder="質問内容を入力"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="newQuestionType" className={labelClass}>
                    タイプ
                  </label>
                  <select
                    id="newQuestionType"
                    value={newQuestion.question_type}
                    onChange={(e) =>
                      updateNewQuestion({
                        question_type: e.target.value as QuestionType,
                        options: [],
                        optionInput: '',
                      })
                    }
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="text">テキスト</option>
                    <option value="email">メール</option>
                    <option value="single_choice">単一選択</option>
                    <option value="multiple_choice">複数選択</option>
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newQuestion.is_required}
                      onChange={(e) =>
                        updateNewQuestion({ is_required: e.target.checked })
                      }
                      className="w-4 h-4 text-primary-600 rounded border-slate-300 cursor-pointer"
                    />
                    <span className="text-sm text-slate-600">必須</span>
                  </label>
                </div>
              </div>

              {/* 選択肢管理 */}
              {isChoiceType(newQuestion.question_type) && (
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-medium text-slate-500 mb-2">
                    選択肢
                  </p>
                  {newQuestion.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-5 text-right">
                        {i + 1}.
                      </span>
                      <span className="flex-1 text-sm text-slate-700">
                        {opt}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(i)}
                        className="text-xs text-red-500 hover:text-red-600 cursor-pointer transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={newQuestion.optionInput}
                      onChange={(e) =>
                        updateNewQuestion({ optionInput: e.target.value })
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                      className={`flex-1 ${inputClass}`}
                      placeholder="選択肢を入力してEnter"
                    />
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="px-3 py-2 text-xs text-primary-600 hover:bg-primary-50 border border-primary-200 rounded-lg cursor-pointer transition-colors"
                    >
                      追加
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleAddQuestion}
                disabled={!newQuestion.question_text.trim()}
                className="w-full px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                + この質問を追加
              </button>
            </div>
          </div>
        </div>

        {/* ボタン */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex-1 px-4 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {saving ? '保存中...' : '保存する'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/dashboard')}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
          >
            キャンセル
          </button>
        </div>
      </main>
    </div>
  );
}
