'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { voterAPI, voteAPI } from '@/lib/api';

type PageState = 'loading' | 'consent' | 'voting' | 'confirm' | 'complete' | 'error' | 'closed';
interface Option { id: number; option_text: string; order: number; }
interface Question { id: number; question_text: string; question_type: 'single_choice' | 'multiple_choice' | 'text' | 'email'; is_required: boolean; order: number; options?: Option[]; }
interface Survey { id: number; token: string; title: string; description: string; end_date: string; questions: Question[]; }
interface Voter { email: string; status: string; }
interface VerifyResponse { voter: Voter; survey: Survey; }
type AnswerValue = number | number[] | string;

export default function AuthVotePage() {
  const params = useParams();
  const voterToken = params.voter_token as string;
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<VerifyResponse | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await voterAPI.verify(voterToken);
        setData(response);
        // 投票期限が過ぎていれば「終了しました」表示に切替
        if (response.survey.end_date && new Date(response.survey.end_date) < new Date()) {
          setPageState('closed');
        } else {
          setPageState('consent');
        }
      }
      catch (error: unknown) {
        const e = error as { response?: { status?: number; data?: { error?: string } } };
        const s = e.response?.status;
        setErrorMessage(s === 403 ? '既に投票済みです。投票は1回のみ有効です。' : s === 404 ? '無効な投票リンクです。URLを確認してください。' : e.response?.data?.error || '認証に失敗しました。');
        setPageState('error');
      }
    };
    verifyToken();
  }, [voterToken]);

  const handleAnswer = (questionId: number, questionType: Question['question_type'], optionId?: number, answerText?: string) => {
    setAnswers((prev) => {
      if (questionType === 'text') return { ...prev, [questionId]: answerText ?? '' };
      if (questionType === 'multiple_choice' && optionId !== undefined) {
        const c = (prev[questionId] as number[]) || [];
        return { ...prev, [questionId]: c.includes(optionId) ? c.filter((id) => id !== optionId) : [...c, optionId] };
      }
      return { ...prev, [questionId]: optionId as number };
    });
  };

  const allRequiredAnswered = data ? data.survey.questions.filter((q) => q.is_required).every((q) => {
    const a = answers[q.id]; if (a === undefined || a === null || a === '') return false; if (Array.isArray(a) && a.length === 0) return false; return true;
  }) : false;

  const handleSubmit = async () => {
    if (!data) return;
    setIsSubmitting(true);
    try {
      const flat: Array<{ question_id: number; option_id?: number; answer_text?: string }> = [];
      for (const q of data.survey.questions) {
        const a = answers[q.id]; if (a === undefined || a === null || a === '') continue;
        if (q.question_type === 'text') flat.push({ question_id: q.id, answer_text: a as string });
        else if (q.question_type === 'multiple_choice') for (const oid of a as number[]) flat.push({ question_id: q.id, option_id: oid });
        else flat.push({ question_id: q.id, option_id: a as number });
      }
      await voteAPI.submitBatch(voterToken, flat);
      setPageState('complete');
    } catch (error: unknown) {
      const e = error as { response?: { status?: number; data?: { error?: string } } };
      const s = e.response?.status;
      setErrorMessage(s === 403 ? '既に投票済みです。重複投票はできません。' : s === 404 ? 'アンケートまたは質問が見つかりません。' : e.response?.data?.error || '投票の送信に失敗しました。');
      setPageState('error');
    } finally { setIsSubmitting(false); }
  };

  if (pageState === 'loading') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" role="status" aria-label="読み込み中" />
        <p className="text-sm text-slate-500">認証中...</p>
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

  if (pageState === 'complete') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-sm w-full p-8 text-center animate-fade-in">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">投票が完了しました</h2>
        <p className="text-sm text-slate-500">ご投票ありがとうございました。</p>
      </div>
    </div>
  );

  if (pageState === 'closed') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-md w-full p-8 text-center animate-fade-in">
        <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-2">投票期間は終了しました</h2>
        {data?.survey?.title && <p className="text-sm text-slate-600 mb-3">「{data.survey.title}」</p>}
        {data?.survey?.end_date && (
          <p className="text-xs text-slate-400 leading-relaxed">
            投票期限: {new Date(data.survey.end_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })}
          </p>
        )}
        <p className="text-sm text-slate-500 leading-relaxed mt-4">ご投票ありがとうございました。</p>
      </div>
    </div>
  );

  if (!data) return null;

  if (pageState === 'consent') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 max-w-lg w-full p-7 animate-fade-in">
        <h1 className="text-xl font-bold text-slate-800 mb-2">{data.survey.title}</h1>
        <p className="text-sm text-slate-500 leading-relaxed mb-4 whitespace-pre-line">{data.survey.description}</p>
        <p className="text-xs text-slate-400 mb-1">{data.voter.email}</p>
        {data.survey.end_date && (
          <p className="text-xs text-slate-400 mb-5">投票期限: {new Date(data.survey.end_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        )}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-primary-700 mb-2">投票に関する注意事項</p>
          <ul className="text-xs text-primary-600 space-y-1 list-disc list-inside">
            <li>投票は1回限りです。一度送信すると変更できません。</li>
            <li>投票内容は完全に匿名で記録されます。</li>
            <li>あなたの投票内容が誰かに知られることはありません。</li>
          </ul>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-slate-700 mb-3">投票に関する確認</p>
          <p className="text-xs text-slate-600 mb-3 leading-relaxed">この投票は誰かに強制されたものではありません。</p>
          <label className="flex items-center cursor-pointer">
            <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} className="w-4 h-4 text-primary-600 border-slate-300 rounded cursor-pointer" />
            <span className="ml-2.5 text-xs text-slate-700">上記の内容に同意します</span>
          </label>
        </div>
        <button onClick={() => { if (consentChecked) setPageState('voting'); }} disabled={!consentChecked} className="w-full py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors">
          同意して投票する
        </button>
      </div>
    </div>
  );

  if (pageState === 'confirm') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 py-10 px-4">
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-7 sm:p-8">
          <h2 className="text-lg font-bold text-slate-800 mb-6">回答内容の確認</h2>
          <div className="space-y-4 mb-8">
            {data.survey.questions.map((q) => {
              const a = answers[q.id]; let text = '（未回答）';
              if (q.question_type === 'text' && typeof a === 'string' && a) text = a;
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
            <button onClick={() => setPageState('voting')} className="flex-1 py-2.5 px-4 border border-slate-200 text-sm text-slate-600 font-medium rounded-xl hover:bg-slate-50 cursor-pointer transition-colors">戻る</button>
            <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-2.5 px-4 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors">
              {isSubmitting ? '送信中...' : '投票を送信'}
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
          <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
            <h1 className="text-xl font-bold text-slate-800">{data.survey.title}</h1>
            <span className="text-xs text-slate-400">{data.voter.email}</span>
          </div>
          <div className="w-12 h-0.5 bg-primary-400 rounded-full mb-8" />

          <div className="space-y-7">
            {data.survey.questions.map((question, index) => (
              <div key={question.id}>
                <p className="flex items-start gap-3 mb-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-bold shrink-0 mt-0.5">{index + 1}</span>
                  <span className="text-sm font-semibold text-slate-800 leading-relaxed">
                    {question.question_text}
                    {question.is_required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                </p>

                {question.question_type === 'text' ? (
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
            <button onClick={() => setPageState('confirm')} disabled={!allRequiredAnswered} className="w-full py-3 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors">
              確認画面へ
            </button>
            {!allRequiredAnswered && <p className="text-xs text-red-500 text-center mt-2">すべての必須項目に回答してください</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
