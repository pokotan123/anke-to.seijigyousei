'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { surveyAPI, voteAPI } from '../../../lib/api';
import { linkify } from '../../../lib/linkify';

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface Question {
  id: number;
  question_text: string;
  question_type: 'single_choice' | 'multiple_choice' | 'text';
  is_required: boolean;
  options?: Option[];
}
interface Option { id: number; option_text: string; }
interface Survey { id: number; title: string; description: string; questions: Question[]; }

export default function VotePage() {
  const params = useParams();
  const token = params.token as string;
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number | number[] | string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(true);
  const [consentChecked, setConsentChecked] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const consentButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('session_id');
      if (!id) { id = generateUUID(); localStorage.setItem('session_id', id); }
      return id;
    }
    return generateUUID();
  });

  const handleModalKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') return;
    if (e.key === 'Tab' && modalRef.current) {
      const els = modalRef.current.querySelectorAll<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])');
      const first = els[0]; const last = els[els.length - 1];
      if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last.focus(); } }
      else { if (document.activeElement === last) { e.preventDefault(); first.focus(); } }
    }
  }, []);

  useEffect(() => { if (showConsentModal && consentButtonRef.current) consentButtonRef.current.focus(); }, [showConsentModal]);

  useEffect(() => {
    const fetchSurvey = async () => {
      try { const data = await surveyAPI.getByToken(token); setSurvey(data); }
      catch (err: any) { setError(err.response?.data?.error || 'アンケートが見つかりません'); }
      finally { setLoading(false); }
    };
    if (token) fetchSurvey();
  }, [token]);

  const handleAnswerChange = (questionId: number, value: number | number[] | string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setValidationErrors((prev) => { const { [questionId]: _, ...rest } = prev; return rest; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errors: Record<number, string> = {};
    for (const question of survey?.questions || []) {
      if (question.is_required) {
        const answer = answers[question.id];
        if (answer === undefined || answer === null || answer === '' || (Array.isArray(answer) && answer.length === 0))
          errors[question.id] = `「${question.question_text}」は必須です`;
      }
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      const el = document.getElementById(`question-${Object.keys(errors)[0]}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    try {
      if (!survey) { setSubmitError('アンケートが見つかりません'); setSubmitting(false); return; }
      const questionIds = survey.questions.map((q) => q.id);
      for (const questionId of questionIds) {
        const answer = answers[questionId]; if (!answer) continue;
        const question = survey.questions.find((q) => q.id === questionId); if (!question) continue;
        if (question.question_type === 'text') {
          await voteAPI.submit({ survey_token: token, question_id: questionId, answer_text: answer }, sessionId);
        } else if (Array.isArray(answer)) {
          for (const optionId of answer) await voteAPI.submit({ survey_token: token, question_id: questionId, option_id: optionId }, sessionId);
        } else {
          await voteAPI.submit({ survey_token: token, question_id: questionId, option_id: answer }, sessionId);
        }
      }
      setSubmitted(true);
    } catch (err: any) { setSubmitError(err.response?.data?.error || '投票の送信に失敗しました'); }
    finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="text-center" role="status" aria-label="読み込み中">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto" />
        <p className="mt-3 text-sm text-slate-500">読み込み中...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 max-w-sm w-full text-center">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </div>
        <p className="text-slate-700">{error}</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50/30 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-8 max-w-sm w-full text-center animate-fade-in">
        <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">投票ありがとうございました</h2>
        <p className="text-sm text-slate-500">ご回答いただき、ありがとうございます。</p>
      </div>
    </div>
  );

  return (
    <>
      {showConsentModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" role="dialog" aria-modal="true" aria-labelledby="consent-title" onKeyDown={handleModalKeyDown} onClick={(e) => { if (e.target === e.currentTarget) setShowConsentModal(false); }}>
          <div ref={modalRef} className="bg-white rounded-2xl shadow-xl p-7 max-w-md w-full animate-fade-in">
            <h2 id="consent-title" className="text-lg font-bold text-slate-800 mb-3">投票に関する確認</h2>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">この投票は誰かに強制されたものではありません</p>
            <label className="flex items-center mb-5 cursor-pointer">
              <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} className="w-4 h-4 text-primary-600 border-slate-300 rounded" />
              <span className="ml-2.5 text-sm text-slate-700">上記の内容に同意します</span>
            </label>
            <div className="flex justify-end">
              <button ref={consentButtonRef} onClick={() => { if (consentChecked) setShowConsentModal(false); }} disabled={!consentChecked} className="px-5 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors">
                次へ
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 py-10 px-4">
        <div className="max-w-2xl mx-auto animate-fade-in">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-7 sm:p-8">
            <div className="text-center mb-8">
              <h1 className="text-xl font-bold text-slate-800">{survey?.title}</h1>
              {survey?.description && <p className="text-sm text-slate-500 mt-2 leading-relaxed whitespace-pre-line text-left">{linkify(survey.description)}</p>}
              <div className="w-12 h-0.5 bg-primary-400 rounded-full mx-auto mt-4" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              {survey?.questions.map((question, index) => (
                <div key={question.id} id={`question-${question.id}`}>
                  <label htmlFor={question.question_type === 'text' ? `answer-${question.id}` : undefined} className="flex items-start gap-3 mb-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-100 text-primary-700 rounded-full text-xs font-bold shrink-0 mt-0.5">{index + 1}</span>
                    <span className="text-sm font-semibold text-slate-800 leading-relaxed">
                      {question.question_text}
                      {question.is_required && <span className="text-red-500 ml-1">*</span>}
                    </span>
                  </label>

                  {question.question_type === 'text' ? (
                    <textarea id={`answer-${question.id}`} className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm resize-none" rows={4} value={(answers[question.id] as string) || ''} onChange={(e) => handleAnswerChange(question.id, e.target.value)} />
                  ) : question.question_type === 'multiple_choice' ? (
                    <div className="space-y-2 ml-9">
                      {question.options?.map((option) => {
                        const checked = ((answers[question.id] as number[]) || []).includes(option.id);
                        return (
                          <label key={option.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${checked ? 'border-primary-300 bg-primary-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="checkbox" className="w-4 h-4 text-primary-600 rounded border-slate-300" checked={checked} onChange={(e) => {
                              const current = (answers[question.id] as number[]) || [];
                              handleAnswerChange(question.id, e.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id));
                            }} />
                            <span className="text-sm text-slate-700">{option.option_text}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2 ml-9">
                      {question.options?.map((option) => {
                        const selected = (answers[question.id] as number) === option.id;
                        return (
                          <label key={option.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${selected ? 'border-primary-300 bg-primary-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="radio" name={`question-${question.id}`} className="w-4 h-4 text-primary-600 border-slate-300" value={option.id} checked={selected} onChange={(e) => handleAnswerChange(question.id, parseInt(e.target.value))} />
                            <span className="text-sm text-slate-700">{option.option_text}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {validationErrors[question.id] && <p className="mt-2 ml-9 text-xs text-red-600" role="alert">{validationErrors[question.id]}</p>}
                </div>
              ))}

              {submitError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3" role="alert">
                  <p className="text-sm text-red-600">{submitError}</p>
                </div>
              )}

              <button type="submit" disabled={submitting} className="w-full py-3 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer transition-colors">
                {submitting ? '送信中...' : '投票する'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
