'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { surveyAPI, questionAPI, authAPI } from '../../../../lib/api';
import type { Survey, Question, Option, SurveyListItem } from '../../../../lib/types';
import QuestionList from '../../../../components/admin/QuestionList';
import QuestionModal from '../../../../components/admin/QuestionModal';
import OptionModal from '../../../../components/admin/OptionModal';
import { useConfirm } from '../../../../components/admin/ConfirmDialog';

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800';
const labelClass = 'block text-sm font-medium text-slate-600 mb-1.5';

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DEFAULT_VOTE_MAIL_BODY = `{email} 様

「{survey_title}」への投票が可能になりました。
下記のボタンから投票画面にお進みください。

投票期限: {end_date}

※このリンクはあなた専用です。他の方への転送はお控えください。
※1度投票すると、リンクは無効になります。`;

const DEFAULT_REMINDER_MAIL_BODY = `{email} 様

「{survey_title}」の投票がまだお済みでないようです。
投票期限({end_date})までに、下記のボタンから投票をお願いいたします。

※このリンクはあなた専用です。他の方への転送はお控えください。`;

const DEFAULT_REGISTRATION_MAIL_BODY = `{email} 様

「{survey_title}」への登録が完了しました。

紐づけ先の投票アンケート「{voting_survey_title}」の投票リンクは、後日メールでお届けします。しばらくお待ちください。

※このメールに心当たりがない場合は破棄してください。`;

export default function SurveyEditPage() {
  const router = useRouter();
  const params = useParams();
  const surveyId = parseInt(params.id as string);
  const confirm = useConfirm();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingOption, setEditingOption] = useState<{ questionId: number; option: Option | null } | null>(null);
  const [availableSurveys, setAvailableSurveys] = useState<SurveyListItem[]>([]);
  const [linkedVotingIds, setLinkedVotingIds] = useState<number[]>([]);

  const closeQuestionModal = useCallback(() => {
    setShowQuestionModal(false);
    setEditingQuestion(null);
  }, []);

  const closeOptionModal = useCallback(() => {
    setEditingOption(null);
  }, []);

  // Esc key handling for modals
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
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showQuestionModal, editingOption, closeQuestionModal, closeOptionModal]);

  const loadSurvey = useCallback(async () => {
    const data = await surveyAPI.get(surveyId);
    const isReg = !!data.require_registration;
    setSurvey({
      ...data,
      vote_mail_body: data.vote_mail_body ?? (isReg ? null : DEFAULT_VOTE_MAIL_BODY),
      reminder_mail_body: data.reminder_mail_body ?? (isReg ? null : DEFAULT_REMINDER_MAIL_BODY),
      registration_mail_body: data.registration_mail_body ?? (isReg ? DEFAULT_REGISTRATION_MAIL_BODY : null),
    });
  }, [surveyId]);

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
        // 1対N: voting-links を取得（登録アンケートのみ意味を持つ）
        try {
          const links = await surveyAPI.listVotingLinks(surveyId);
          setLinkedVotingIds(links.voting_survey_ids || []);
        } catch {
          setLinkedVotingIds([]);
        }
      } catch {
        localStorage.removeItem('token');
        router.push('/admin/login');
      } finally {
        setLoading(false);
      }
    };
    if (surveyId) {
      checkAuth();
    }
  }, [surveyId, router, loadSurvey]);

  // --- Handlers ---

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
        registration_start_date: survey.registration_start_date,
        require_registration: survey.require_registration,
        registration_message: survey.registration_message,
        registration_deadline: survey.registration_deadline,
        registration_fields: (survey.registration_fields || []).filter((f) => f.name.trim() !== ''),
        vote_mail_body: survey.vote_mail_body,
        reminder_mail_body: survey.reminder_mail_body,
        registration_mail_body: survey.registration_mail_body,
      });
      alert('保存しました');
    } catch (err: any) {
      alert(err.response?.data?.error || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateToken = async () => {
    const ok = await confirm({
      title: 'URLトークンを再発行',
      message: 'URLトークンを再発行しますか？旧URLは無効になります。',
      confirmLabel: '再発行',
      danger: true,
    });
    if (!ok) return;
    try {
      const updated = await surveyAPI.regenerateToken(surveyId);
      if (updated && survey) {
        setSurvey({ ...survey, unique_token: updated.unique_token });
        alert('URLトークンを再発行しました');
      }
    } catch (err: any) {
      alert(err.response?.data?.error || '再発行に失敗しました');
    }
  };

  const copyUrl = () => {
    if (!survey) return;
    const prefix = survey.require_registration ? 'register' : 'vote';
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/${prefix}/${survey.unique_token}`;
    navigator.clipboard.writeText(url);
    alert('URLをコピーしました');
  };

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
    const ok = await confirm({
      title: '質問を削除',
      message: 'この質問を削除しますか？',
      confirmLabel: '削除',
      danger: true,
    });
    if (!ok) return;
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
        await questionAPI.create({
          survey_id: surveyId,
          question_text: editingQuestion.question_text,
          question_type: editingQuestion.question_type,
          order: editingQuestion.order,
          is_required: editingQuestion.is_required,
        });
      } else {
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

  const handleAddOption = (questionId: number) => {
    setEditingOption({ questionId, option: { id: 0, option_text: '', order: 0 } });
  };

  const handleEditOption = (questionId: number, option: Option) => {
    setEditingOption({ questionId, option: { ...option } });
  };

  const handleDeleteOption = async (optionId: number) => {
    const ok = await confirm({
      title: '選択肢を削除',
      message: 'この選択肢を削除しますか？',
      confirmLabel: '削除',
      danger: true,
    });
    if (!ok) return;
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
        await questionAPI.createOption(editingOption.questionId, {
          option_text: editingOption.option.option_text,
          order: editingOption.option.order,
        });
      } else {
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

  const handleMoveQuestion = async (questionId: number, direction: 'up' | 'down') => {
    if (!survey) return;
    const currentIndex = survey.questions.findIndex((q) => q.id === questionId);
    if (currentIndex === -1) return;
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= survey.questions.length) return;
    const currentQuestion = survey.questions[currentIndex];
    const targetQuestion = survey.questions[newIndex];
    try {
      await questionAPI.update(currentQuestion.id, { order: targetQuestion.order });
      await questionAPI.update(targetQuestion.id, { order: currentQuestion.order });
      await loadSurvey();
    } catch (err: any) {
      alert(err.response?.data?.error || '順序の変更に失敗しました');
    }
  };

  const handleMoveOption = async (questionId: number, optionId: number, direction: 'up' | 'down') => {
    if (!survey) return;
    const question = survey.questions.find((q) => q.id === questionId);
    if (!question?.options) return;
    const currentIndex = question.options.findIndex((o) => o.id === optionId);
    if (currentIndex === -1) return;
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= question.options.length) return;
    const currentOption = question.options[currentIndex];
    const targetOption = question.options[newIndex];
    try {
      await questionAPI.updateOption(currentOption.id, { order: targetOption.order });
      await questionAPI.updateOption(targetOption.id, { order: currentOption.order });
      await loadSurvey();
    } catch (err: any) {
      alert(err.response?.data?.error || '順序の変更に失敗しました');
    }
  };

  /** 1対N: 登録アンケートの voting-links を一括更新 */
  const handleVotingLinksUpdate = async (newVotingIds: number[]) => {
    if (!survey) return;
    try {
      await surveyAPI.updateVotingLinks(survey.id, newVotingIds, survey.updated_at);
      await loadSurvey();
      const updated = await surveyAPI.listVotingLinks(survey.id);
      setLinkedVotingIds(updated.voting_survey_ids);
    } catch (err: any) {
      alert(err.response?.data?.error || '紐付けの変更に失敗しました');
    }
  };

  /** 1対N: 後付けで追加した投票アンケートを既存登録者に通知 */
  const handleNotifyNewLink = async (votingId: number) => {
    if (!survey) return;
    const ok = await confirm({
      title: '投票リンクを通知',
      message: 'この投票アンケートを既存登録者全員にメール通知しますか？',
      confirmLabel: '通知',
    });
    if (!ok) return;
    try {
      const result = await surveyAPI.notifyVotingLink(survey.id, votingId);
      alert(`通知メールを ${result.enqueued} 件キューに追加しました（スキップ: ${result.skipped} 件）`);
    } catch (err: any) {
      alert(err.response?.data?.error || '通知に失敗しました');
    }
  };

  // --- Render ---

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
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-sm text-slate-600">アンケートが見つかりません</p>
        </div>
      </div>
    );
  }

  const isRegistrationSurvey = !!survey.require_registration;
  const headerTitle = isRegistrationSurvey ? '登録アンケート編集' : '投票アンケート編集';
  const urlPrefix = isRegistrationSurvey ? 'register' : 'vote';
  const surveyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/${urlPrefix}/${survey.unique_token}`;
  // 1対N: 投票アンケート候補（require_registration=false の他アンケート）
  const votingCandidates = availableSurveys.filter((s) => s.id !== survey.id && !s.require_registration);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-4">
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="text-primary-600 hover:text-primary-700 text-sm cursor-pointer transition-colors"
            >
              &larr; 一覧に戻る
            </button>
            <h1 className="font-bold text-slate-800">{headerTitle}</h1>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
        {/* 基本情報カード */}
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

            {/* 日程設定（種別ごとに表示する項目を切り替え） */}
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-700 mb-3">日程設定</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isRegistrationSurvey ? (
                  <>
                    <div>
                      <label htmlFor="registrationStartDate" className={labelClass}>登録開始日時</label>
                      <input
                        id="registrationStartDate"
                        type="datetime-local"
                        value={toDatetimeLocal(survey.registration_start_date)}
                        onChange={(e) => setSurvey({ ...survey, registration_start_date: e.target.value || null })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="registrationDeadline" className={labelClass}>登録締切日時</label>
                      <input
                        id="registrationDeadline"
                        type="datetime-local"
                        value={toDatetimeLocal(survey.registration_deadline)}
                        onChange={(e) => setSurvey({ ...survey, registration_deadline: e.target.value || null })}
                        className={inputClass}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label htmlFor="startDate" className={labelClass}>投票開始日時</label>
                      <input
                        id="startDate"
                        type="datetime-local"
                        value={toDatetimeLocal(survey.start_date)}
                        onChange={(e) => setSurvey({ ...survey, start_date: e.target.value || null })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="endDate" className={labelClass}>投票終了日時</label>
                      <input
                        id="endDate"
                        type="datetime-local"
                        value={toDatetimeLocal(survey.end_date)}
                        onChange={(e) => setSurvey({ ...survey, end_date: e.target.value || null })}
                        className={inputClass}
                      />
                    </div>
                  </>
                )}
              </div>
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
          </div>

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

        {/* URL情報カード */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 mb-6">
          <h2 className="text-sm font-bold text-slate-800 mb-4">URL情報</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={surveyUrl}
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

        {/* 投票アンケート側は read-only 表示のみ（紐付け編集は登録アンケート側で行う） */}
        {!isRegistrationSurvey && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 mb-6">
            <h2 className="text-sm font-bold text-slate-800 mb-2">紐付け情報</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              この投票アンケートへの紐付けは、登録アンケートの編集画面から行ってください（1対N対応）。
            </p>
          </div>
        )}

        {/* 登録アンケート: 1対N で投票アンケートを複数紐付け */}
        {isRegistrationSurvey && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 mb-6">
            <h2 className="text-sm font-bold text-slate-800 mb-2">紐付け先投票アンケート（複数選択可）</h2>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              この登録アンケートに紐付ける投票アンケートを選択してください。登録者には選択した全ての投票アンケートのリンクが届きます。
            </p>
            <div className="space-y-2">
              {votingCandidates.length === 0 ? (
                <p className="text-xs text-slate-400">紐付け可能な投票アンケートがありません。先に投票アンケートを作成してください。</p>
              ) : (
                votingCandidates.map((s) => {
                  const checked = linkedVotingIds.includes(s.id);
                  const isNewlyAdded = checked; // 既存紐付けかどうかは状態管理しない簡素版
                  return (
                    <div key={s.id} className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...linkedVotingIds, s.id]
                              : linkedVotingIds.filter((id) => id !== s.id);
                            handleVotingLinksUpdate(next);
                          }}
                        />
                        <span className="text-sm text-slate-700">{s.title}</span>
                      </label>
                      {isNewlyAdded && (
                        <button
                          type="button"
                          onClick={() => handleNotifyNewLink(s.id)}
                          className="px-2 py-1 text-xs bg-primary-50 text-primary-700 rounded hover:bg-primary-100"
                          title="既存登録者全員に通知メールを送る"
                        >
                          通知送信
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <p className="text-xs text-slate-400 mt-3 leading-relaxed">
              ※ 後から投票アンケートを追加した場合、「通知送信」ボタンで既存登録者にメール通知できます（重複送信は自動防止）。
            </p>
          </div>
        )}

        {/* メール文面設定カード */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8 mb-6">
          <h2 className="text-sm font-bold text-slate-800 mb-2">メール文面設定</h2>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            本文中で下記のタグを使用すると、送信時に実際の値に置換されます。
          </p>
          <div className="space-y-5">
            {!isRegistrationSurvey ? (
              <>
                <div>
                  <label htmlFor="voteMailBody" className={labelClass}>投票リンクメール本文</label>
                  <textarea
                    id="voteMailBody"
                    value={survey.vote_mail_body || ''}
                    onChange={(e) => setSurvey({ ...survey, vote_mail_body: e.target.value || null })}
                    rows={8}
                    className={`${inputClass} resize-none leading-relaxed`}
                  />
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-1.5">利用可能なタグ</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      <p className="text-xs text-slate-400"><code className="bg-slate-200 text-slate-600 px-1 rounded">{'survey_title'}</code> アンケート名</p>
                      <p className="text-xs text-slate-400"><code className="bg-slate-200 text-slate-600 px-1 rounded">{'email'}</code> 投票者のメールアドレス</p>
                      <p className="text-xs text-slate-400"><code className="bg-slate-200 text-slate-600 px-1 rounded">{'end_date'}</code> 投票期限日時</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">※ 投票リンクはメール末尾に自動挿入されます</p>
                  </div>
                </div>
                <div>
                  <label htmlFor="reminderMailBody" className={labelClass}>リマインドメール本文</label>
                  <textarea
                    id="reminderMailBody"
                    value={survey.reminder_mail_body || ''}
                    onChange={(e) => setSurvey({ ...survey, reminder_mail_body: e.target.value || null })}
                    rows={8}
                    className={`${inputClass} resize-none leading-relaxed`}
                  />
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-1.5">利用可能なタグ</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      <p className="text-xs text-slate-400"><code className="bg-slate-200 text-slate-600 px-1 rounded">{'survey_title'}</code> アンケート名</p>
                      <p className="text-xs text-slate-400"><code className="bg-slate-200 text-slate-600 px-1 rounded">{'email'}</code> 投票者のメールアドレス</p>
                      <p className="text-xs text-slate-400"><code className="bg-slate-200 text-slate-600 px-1 rounded">{'end_date'}</code> 投票期限日時</p>
                    </div>
                    <p className="text-xs text-slate-400 mt-1.5">※ 投票リンクはメール末尾に自動挿入されます</p>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="registrationMailBody" className={labelClass}>登録完了メール本文</label>
                <textarea
                  id="registrationMailBody"
                  value={survey.registration_mail_body || ''}
                  onChange={(e) => setSurvey({ ...survey, registration_mail_body: e.target.value || null })}
                  rows={8}
                  className={`${inputClass} resize-none leading-relaxed`}
                />
                <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">利用可能なタグ</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    <p className="text-xs text-slate-400"><code className="bg-slate-200 text-slate-600 px-1 rounded">{'survey_title'}</code> 登録アンケート名</p>
                    <p className="text-xs text-slate-400"><code className="bg-slate-200 text-slate-600 px-1 rounded">{'email'}</code> 登録者のメールアドレス</p>
                    <p className="text-xs text-slate-400"><code className="bg-slate-200 text-slate-600 px-1 rounded">{'voting_survey_title'}</code> 投票アンケート名（複数紐付け時は「、」区切り）</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">※ このメールには投票リンクは含まれません。投票リンクは投票者管理画面の「投票リンク一括送信」ボタンから別途送信してください。</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 質問管理 */}
        <QuestionList
          questions={survey.questions}
          readOnlyQuestionTypes={isRegistrationSurvey ? ['email'] : []}
          onAddQuestion={handleAddQuestion}
          onEditQuestion={handleEditQuestion}
          onDeleteQuestion={handleDeleteQuestion}
          onMoveQuestion={handleMoveQuestion}
          onAddOption={handleAddOption}
          onEditOption={handleEditOption}
          onDeleteOption={handleDeleteOption}
          onMoveOption={handleMoveOption}
        />

        {/* 質問編集モーダル */}
        {showQuestionModal && editingQuestion && (
          <QuestionModal
            question={editingQuestion}
            onChange={setEditingQuestion}
            onSave={handleSaveQuestion}
            onClose={closeQuestionModal}
          />
        )}

        {/* 選択肢編集モーダル */}
        {editingOption && editingOption.option && (
          <OptionModal
            option={editingOption.option}
            isNew={editingOption.option.id === 0}
            onChange={(updated) => setEditingOption({ ...editingOption, option: updated })}
            onSave={handleSaveOption}
            onClose={closeOptionModal}
          />
        )}
      </main>
    </div>
  );
}
