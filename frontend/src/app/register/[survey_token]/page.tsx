'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { surveyAPI, voterAPI } from '../../../lib/api';

type PageState = 'loading' | 'form' | 'confirm' | 'success' | 'error' | 'closed';
interface Option { id: number; option_text: string; order: number; }
interface Question { id: number; question_text: string; question_type: 'single_choice' | 'multiple_choice' | 'text' | 'email'; is_required: boolean; order: number; options?: Option[]; }
interface SurveyData { id: number; unique_token: string; title: string; description: string; registration_deadline: string | null; registration_message: string | null; questions: Question[]; }
type AnswerValue = number | number[] | string;

export default function RegisterPage() {
  const params = useParams();
  const surveyToken = params.survey_token as string;
  const [survey, setSurvey] = useState<SurveyData | null>(null);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const data = await surveyAPI.getByToken(surveyToken);
        setSurvey(data);
        // 登録締切が過ぎていれば「終了しました」表示に切替
        if (data.registration_deadline && new Date(data.registration_deadline) < new Date()) {
          setPageState('closed');
        } else {
          setPageState('form');
        }
      }
      catch (err: unknown) { const e = err as { response?: { data?: { error?: string } } }; setErrorMessage(e.response?.data?.error || 'アンケートが見つかりません'); setPageState('error'); }
    };
    if (surveyToken) fetchSurvey();
  }, [surveyToken]);

  const handleAnswer = (questionId: number, questionType: Question['question_type'], optionId?: number, answerText?: string) => {
    setAnswers((prev) => {
      if (questionType === 'text' || questionType === 'email') {
        if (questionType === 'email' && emailError) { if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answerText ?? '')) setEmailError(''); }
        return { ...prev, [questionId]: answerText ?? '' };
      }
      if (questionType === 'multiple_choice' && optionId !== undefined) {
        const current = (prev[questionId] as number[]) || [];
        return { ...prev, [questionId]: current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId] };
      }
      return { ...prev, [questionId]: optionId as number };
    });
  };

  const allRequiredAnswered = survey ? survey.questions.filter((q) => q.is_required).every((q) => {
    const a = answers[q.id]; if (a === undefined || a === null || a === '') return false; if (Array.isArray(a) && a.length === 0) return false; return true;
  }) : false;

  const validateEmail = (): boolean => {
    if (!survey) return false;
    const emailQ = survey.questions.find((q) => q.question_type === 'email');
    if (!emailQ) return true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((answers[emailQ.id] as string) || '')) { setEmailError('有効なメールアドレスを入力してください'); return false; }
    setEmailError(''); return true;
  };

  const handleSubmit = async () => {
    if (!survey || !validateEmail()) return;
    setIsSubmitting(true);
    try {
      const flatAnswers: Array<{ question_id: number; option_id?: number; answer_text?: string }> = [];
      for (const q of survey.questions) {
        const a = answers[q.id]; if (a === undefined || a === null || a === '') continue;
        if (q.question_type === 'text' || q.question_type === 'email') flatAnswers.push({ question_id: q.id, answer_text: a as string });
        else if (q.question_type === 'multiple_choice') for (const oid of a as number[]) flatAnswers.push({ question_id: q.id, option_id: oid });
        else flatAnswers.push({ question_id: q.id, option_id: a as number });
      }
      await voterAPI.registerWithAnswers(surveyToken, flatAnswers);
      setPageState('success');
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } } };
      setErrorMessage(e.response?.status === 409 ? 'このメールアドレスは既に登録されています。' : e.response?.data?.error || '登録に失敗しました。');
      setPageState('error');
    } finally { setIsSubmitting(false); }
  };

  if (pageState === 'loading') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" role="status" aria-label="読み込み中" />
        <p className="text-sm text-slate-500">読み込み中...</p>
      </div>
    </div>
  );

  if (pageState === 'error') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-sm w-full p-8 text-center animate-fade-in">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">エラー</h2>
        <p className="text-sm text-slate-600 leading-relaxed">{errorMessage}</p>
      </div>
    </div>
  );

  if (pageState === 'closed') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-md w-full p-8 text-center animate-fade-in">
        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">登録受付は終了しました</h2>
        {survey?.title && <p className="text-sm text-slate-600 mb-3">「{survey.title}」</p>}
        {survey?.registration_deadline && (
          <p className="text-xs text-slate-400 leading-relaxed">
            締切: {new Date(survey.registration_deadline).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}
          </p>
        )}
        <p className="text-sm text-slate-500 leading-relaxed mt-4">ご参加ありがとうございました。</p>
      </div>
    </div>
  );

  if (pageState === 'success') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-sm w-full p-8 text-center animate-fade-in">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">登録が完了しました</h2>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-700">
          <p className="leading-relaxed">投票リンクは後ほどメールでお届けします。<br />メールが届くまでしばらくお待ちください。</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 mt-3">
          <p className="leading-relaxed">自動返信メールが届かない場合は、迷惑メールフォルダをご確認いただくか、受信設定で当システムからのメールを許可してください。</p>
        </div>
      </div>
    </div>
  );

  if (!survey) return null;

  if (pageState === 'confirm') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 py-10 px-4">
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-7 sm:p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-6">回答内容の確認</h2>
          <div className="space-y-4 mb-8">
            {survey.questions.map((q) => {
              const a = answers[q.id]; let text = '（未回答）';
              if ((q.question_type === 'text' || q.question_type === 'email') && typeof a === 'string' && a) text = a;
              else if (q.question_type === 'multiple_choice' && Array.isArray(a) && a.length > 0) text = a.map((id) => q.options?.find((o) => o.id === id)?.option_text ?? '').filter(Boolean).join('、');
              else if (typeof a === 'number') text = q.options?.find((o) => o.id === a)?.option_text ?? '（未回答）';
              return (
                <div key={q.id} className="border-b border-slate-100 pb-4">
                  <p className="text-xs font-medium text-slate-500 mb-1">{q.question_text}</p>
                  <p className="text-sm text-slate-800 leading-relaxed">{text}</p>
                </div>
              );
            })}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setPageState('form')} className="flex-1 py-2.5 px-4 border border-slate-200 text-sm text-slate-600 font-medium rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">戻る</button>
            <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-2.5 px-4 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors">
              {isSubmitting ? '送信中...' : '登録する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 py-10 px-4">
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-7 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-xl font-bold text-slate-800">{survey.title}</h1>
            {survey.description && <p className="text-sm text-slate-500 mt-2 leading-relaxed whitespace-pre-line text-left">{survey.description}</p>}
            {survey.registration_deadline && (
              <p className="text-xs text-slate-400 mt-2">登録締切: {new Date(survey.registration_deadline).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            )}
            <div className="w-12 h-0.5 bg-primary-400 rounded-full mx-auto mt-4" />
          </div>

          <div className="space-y-7">
            {survey.questions.map((question, index) => (
              <div key={question.id}>
                <p className="flex items-start gap-3 mb-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-bold shrink-0 mt-0.5">{index + 1}</span>
                  <span className="text-sm font-semibold text-slate-800 leading-relaxed">
                    {question.question_text}
                    {question.is_required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                </p>

                {question.question_type === 'email' ? (
                  <div className="ml-9">
                    <label htmlFor={`email-${question.id}`} className="sr-only">{question.question_text}</label>
                    <input type="email" id={`email-${question.id}`} className={`w-full px-4 py-3 border rounded-xl text-sm ${emailError ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`} placeholder="example@email.com" value={(answers[question.id] as string) || ''} onChange={(e) => handleAnswer(question.id, 'email', undefined, e.target.value)} onBlur={validateEmail} />
                    {emailError && <p className="text-xs text-red-600 mt-1.5">{emailError}</p>}
                  </div>
                ) : question.question_type === 'text' ? (
                  <div className="ml-9">
                    <label htmlFor={`textarea-${question.id}`} className="sr-only">{question.question_text}</label>
                    <textarea id={`textarea-${question.id}`} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none" rows={3} placeholder="回答を入力してください" value={(answers[question.id] as string) || ''} onChange={(e) => handleAnswer(question.id, 'text', undefined, e.target.value)} />
                  </div>
                ) : question.question_type === 'multiple_choice' ? (
                  <div className="space-y-2 ml-9">
                    {question.options?.map((option) => {
                      const sel = ((answers[question.id] as number[]) || []).includes(option.id);
                      return (
                        <label key={option.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${sel ? 'border-primary-300 bg-primary-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                          <input type="checkbox" checked={sel} onChange={() => handleAnswer(question.id, 'multiple_choice', option.id)} className="w-4 h-4 text-primary-600 rounded border-slate-300 cursor-pointer" />
                          <span className="text-sm text-slate-700">{option.option_text}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2 ml-9">
                    {question.options?.map((option) => {
                      const sel = (answers[question.id] as number) === option.id;
                      return (
                        <label key={option.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${sel ? 'border-primary-300 bg-primary-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                          <input type="radio" name={`question-${question.id}`} checked={sel} onChange={() => handleAnswer(question.id, 'single_choice', option.id)} className="w-4 h-4 text-primary-600 border-slate-300 cursor-pointer" />
                          <span className="text-sm text-slate-700">{option.option_text}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8">
            <button onClick={() => { if (validateEmail()) setPageState('confirm'); }} disabled={!allRequiredAnswered} className="w-full py-3 px-4 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors">
              確認画面へ
            </button>
            {!allRequiredAnswered && <p className="text-xs text-red-500 text-center mt-2">すべての必須項目に回答してください</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
