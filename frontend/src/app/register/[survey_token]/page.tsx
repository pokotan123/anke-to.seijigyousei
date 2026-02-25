'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { surveyAPI, voterAPI } from '../../../lib/api';

type PageState = 'loading' | 'form' | 'confirm' | 'success' | 'error';

interface Option {
  id: number;
  option_text: string;
  order: number;
}

interface Question {
  id: number;
  question_text: string;
  question_type: 'single_choice' | 'multiple_choice' | 'text' | 'email';
  is_required: boolean;
  order: number;
  options?: Option[];
}

interface SurveyData {
  id: number;
  unique_token: string;
  title: string;
  description: string;
  registration_deadline: string | null;
  registration_message: string | null;
  questions: Question[];
}

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
        setPageState('form');
      } catch (err: unknown) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        setErrorMessage(axiosError.response?.data?.error || 'アンケートが見つかりません');
        setPageState('error');
      }
    };
    if (surveyToken) fetchSurvey();
  }, [surveyToken]);

  const handleAnswer = (
    questionId: number,
    questionType: Question['question_type'],
    optionId?: number,
    answerText?: string
  ) => {
    setAnswers((prev) => {
      if (questionType === 'text' || questionType === 'email') {
        if (questionType === 'email' && emailError) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (emailRegex.test(answerText ?? '')) setEmailError('');
        }
        return { ...prev, [questionId]: answerText ?? '' };
      }
      if (questionType === 'multiple_choice' && optionId !== undefined) {
        const current = (prev[questionId] as number[]) || [];
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: optionId as number };
    });
  };

  const allRequiredAnswered = survey
    ? survey.questions
        .filter((q) => q.is_required)
        .every((q) => {
          const answer = answers[q.id];
          if (answer === undefined || answer === null || answer === '') return false;
          if (Array.isArray(answer) && answer.length === 0) return false;
          return true;
        })
    : false;

  const validateEmail = (): boolean => {
    if (!survey) return false;
    const emailQ = survey.questions.find((q) => q.question_type === 'email');
    if (!emailQ) return true;
    const val = (answers[emailQ.id] as string) || '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      setEmailError('有効なメールアドレスを入力してください');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!survey) return;
    if (!validateEmail()) return;

    setIsSubmitting(true);
    try {
      const flatAnswers: Array<{ question_id: number; option_id?: number; answer_text?: string }> = [];
      for (const question of survey.questions) {
        const answer = answers[question.id];
        if (answer === undefined || answer === null || answer === '') continue;
        if (question.question_type === 'text' || question.question_type === 'email') {
          flatAnswers.push({ question_id: question.id, answer_text: answer as string });
        } else if (question.question_type === 'multiple_choice') {
          for (const optionId of answer as number[]) {
            flatAnswers.push({ question_id: question.id, option_id: optionId });
          }
        } else {
          flatAnswers.push({ question_id: question.id, option_id: answer as number });
        }
      }

      await voterAPI.registerWithAnswers(surveyToken, flatAnswers);
      setPageState('success');
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { error?: string } } };
      const status = axiosError.response?.status;
      const message =
        status === 409
          ? 'このメールアドレスは既に登録されています。'
          : axiosError.response?.data?.error || '登録に失敗しました。';
      setErrorMessage(message);
      setPageState('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" role="status" aria-label="読み込み中" />
          <p className="text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">エラー</h2>
          <p className="text-gray-600 leading-relaxed">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">登録が完了しました</h2>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            <p className="leading-relaxed">投票リンクは後日メールでお届けします。<br />メールが届くまでしばらくお待ちください。</p>
          </div>
        </div>
      </div>
    );
  }

  if (!survey) return null;

  if (pageState === 'confirm') {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">回答内容の確認</h2>
            <div className="space-y-4 mb-8">
              {survey.questions.map((q) => {
                const answer = answers[q.id];
                let displayText = '（未回答）';
                if ((q.question_type === 'text' || q.question_type === 'email') && typeof answer === 'string' && answer) {
                  displayText = answer;
                } else if (q.question_type === 'multiple_choice' && Array.isArray(answer) && answer.length > 0) {
                  displayText = answer
                    .map((id) => q.options?.find((o) => o.id === id)?.option_text ?? '')
                    .filter(Boolean)
                    .join('、');
                } else if (typeof answer === 'number') {
                  displayText = q.options?.find((o) => o.id === answer)?.option_text ?? '（未回答）';
                }
                return (
                  <div key={q.id} className="border-b pb-4">
                    <p className="text-sm font-medium text-gray-700 mb-1">{q.question_text}</p>
                    <p className="text-gray-900 leading-relaxed">{displayText}</p>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPageState('form')} className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200">
                戻る
              </button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200">
                {isSubmitting ? '送信中...' : '登録する'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-900">{survey.title}</h1>
            {survey.description && <p className="text-gray-600 mt-2 leading-relaxed">{survey.description}</p>}
            {survey.registration_deadline && (
              <p className="text-sm text-gray-500 mt-2">
                登録締切: {new Date(survey.registration_deadline).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          <div className="space-y-8">
            {survey.questions.map((question, index) => (
              <div key={question.id} className="border-b pb-6 last:border-b-0">
                <p className="font-medium text-gray-900 mb-3 leading-relaxed">
                  <span className="text-blue-600 mr-2">Q{index + 1}.</span>
                  {question.question_text}
                  {question.is_required && <span className="text-red-500 ml-1">*</span>}
                </p>

                {question.question_type === 'email' ? (
                  <div>
                    <label htmlFor={`email-${question.id}`} className="sr-only">{question.question_text}</label>
                    <input
                      type="email"
                      id={`email-${question.id}`}
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${emailError ? 'border-red-300 bg-red-50' : 'border-gray-300'}`}
                      placeholder="example@email.com"
                      value={(answers[question.id] as string) || ''}
                      onChange={(e) => handleAnswer(question.id, 'email', undefined, e.target.value)}
                      onBlur={validateEmail}
                    />
                    {emailError && <p className="text-sm text-red-600 mt-1">{emailError}</p>}
                  </div>
                ) : question.question_type === 'text' ? (
                  <div>
                    <label htmlFor={`textarea-${question.id}`} className="sr-only">{question.question_text}</label>
                    <textarea
                      id={`textarea-${question.id}`}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      rows={3}
                      placeholder="回答を入力してください"
                      value={(answers[question.id] as string) || ''}
                      onChange={(e) => handleAnswer(question.id, 'text', undefined, e.target.value)}
                    />
                  </div>
                ) : question.question_type === 'multiple_choice' ? (
                  <div className="space-y-2">
                    {question.options?.map((option) => {
                      const selected = ((answers[question.id] as number[]) || []).includes(option.id);
                      return (
                        <label key={option.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors duration-200 ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="checkbox" checked={selected} onChange={() => handleAnswer(question.id, 'multiple_choice', option.id)} className="h-4 w-4 text-blue-600 cursor-pointer" />
                          <span className="text-gray-700">{option.option_text}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {question.options?.map((option) => {
                      const isSelected = (answers[question.id] as number) === option.id;
                      return (
                        <label key={option.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors duration-200 ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="radio" name={`question-${question.id}`} checked={isSelected} onChange={() => handleAnswer(question.id, 'single_choice', option.id)} className="h-4 w-4 text-blue-600 cursor-pointer" />
                          <span className="text-gray-700">{option.option_text}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8">
            <button
              onClick={() => { if (validateEmail()) setPageState('confirm'); }}
              disabled={!allRequiredAnswered}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
            >
              確認画面へ
            </button>
            {!allRequiredAnswered && (
              <p className="text-sm text-red-500 text-center mt-2">すべての必須項目に回答してください</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
