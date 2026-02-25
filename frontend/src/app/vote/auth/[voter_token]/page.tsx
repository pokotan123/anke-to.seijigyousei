'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { voterAPI, voteAPI } from '@/lib/api';

type PageState = 'loading' | 'consent' | 'voting' | 'confirm' | 'complete' | 'error';

interface Option {
  id: number;
  option_text: string;
  order: number;
}

interface Question {
  id: number;
  question_text: string;
  question_type: 'single_choice' | 'multiple_choice' | 'text';
  is_required: boolean;
  order: number;
  options?: Option[];
}

interface Survey {
  id: number;
  title: string;
  description: string;
  end_date: string;
  questions: Question[];
}

interface Voter {
  email: string;
  status: string;
}

interface VerifyResponse {
  voter: Voter;
  survey: Survey;
}

interface Answer {
  question_id: number;
  option_id?: number;
  answer_text?: string;
}

export default function AuthVotePage() {
  const params = useParams();
  const voterToken = params.voter_token as string;
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<VerifyResponse | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await voterAPI.verify(voterToken);
        setData(response);
        setPageState('consent');
      } catch (error: unknown) {
        const axiosError = error as { response?: { data?: { error?: string } } };
        const message = axiosError.response?.data?.error || '認証に失敗しました。URLを確認してください。';
        setErrorMessage(message);
        setPageState('error');
      }
    };
    verifyToken();
  }, [voterToken]);

  const handleAnswer = (questionId: number, optionId?: number, answerText?: string) => {
    setAnswers(prev => {
      const filtered = prev.filter(a => a.question_id !== questionId);
      return [...filtered, { question_id: questionId, option_id: optionId, answer_text: answerText }];
    });
  };

  const allQuestionsAnswered = data
    ? data.survey.questions
        .filter(q => q.is_required)
        .every(q => answers.some(a => a.question_id === q.id))
    : false;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await voteAPI.submitWithToken({ answers }, voterToken);
      setPageState('complete');
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      const message = axiosError.response?.data?.error || '投票の送信に失敗しました。';
      setErrorMessage(message);
      setPageState('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ローディング
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4"
            role="status"
            aria-label="読み込み中"
          ></div>
          <p className="text-gray-600">認証中...</p>
        </div>
      </div>
    );
  }

  // エラー
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

  // 投票完了
  if (pageState === 'complete') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">投票が完了しました</h2>
          <p className="text-gray-600 leading-relaxed">ご投票ありがとうございました。</p>
        </div>
      </div>
    );
  }

  // data が null の場合は何も表示しない（通常到達しない）
  if (!data) {
    return null;
  }

  // 同意確認モーダル
  if (pageState === 'consent') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-lg w-full p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-2">{data.survey.title}</h1>
          <p className="text-gray-600 leading-relaxed mb-4">{data.survey.description}</p>
          <div className="text-sm text-gray-500 mb-2">
            ログイン: {data.voter.email}
          </div>
          {data.survey.end_date && (
            <div className="text-sm text-gray-500 mb-6">
              投票期限: {new Date(data.survey.end_date).toLocaleDateString('ja-JP', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </div>
          )}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-yellow-800 font-medium mb-2">投票に関する注意事項</p>
            <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
              <li>投票は1回限りです。一度送信すると変更できません。</li>
              <li>投票内容は完全に匿名で記録されます。</li>
              <li>あなたの投票内容が誰かに知られることはありません。</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setPageState('voting')}
              className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors duration-200"
            >
              同意して投票する
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 確認画面
  if (pageState === 'confirm') {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">回答内容の確認</h2>
            <div className="space-y-4 mb-8">
              {data.survey.questions.map((q) => {
                const answer = answers.find(a => a.question_id === q.id);
                const selectedOption = q.options?.find(o => o.id === answer?.option_id);
                return (
                  <div key={q.id} className="border-b pb-4">
                    <p className="text-sm font-medium text-gray-700 mb-1">{q.question_text}</p>
                    <p className="text-gray-900 leading-relaxed">
                      {selectedOption?.option_text || answer?.answer_text || '（未回答）'}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPageState('voting')}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-200"
              >
                戻る
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
              >
                {isSubmitting ? '送信中...' : '投票を送信'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 投票フォーム
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex flex-wrap justify-between items-start gap-2 mb-6">
            <h1 className="text-xl font-bold text-gray-900">{data.survey.title}</h1>
            <span className="text-xs text-gray-500">{data.voter.email}</span>
          </div>

          <div className="space-y-8">
            {data.survey.questions.map((question, index) => (
              <div key={question.id} className="border-b pb-6 last:border-b-0">
                <p className="font-medium text-gray-900 mb-3 leading-relaxed">
                  <span className="text-blue-600 mr-2">Q{index + 1}.</span>
                  {question.question_text}
                  {question.is_required && <span className="text-red-500 ml-1">*</span>}
                </p>

                {question.question_type === 'text' ? (
                  <div>
                    <label htmlFor={`textarea-${question.id}`} className="sr-only">
                      {question.question_text}
                    </label>
                    <textarea
                      id={`textarea-${question.id}`}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      rows={3}
                      placeholder="回答を入力してください"
                      value={answers.find(a => a.question_id === question.id)?.answer_text || ''}
                      onChange={(e) => handleAnswer(question.id, undefined, e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    {question.options?.map((option) => {
                      const isSelected = answers.find(a => a.question_id === question.id)?.option_id === option.id;
                      return (
                        <label
                          key={option.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors duration-200 ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            checked={isSelected}
                            onChange={() => handleAnswer(question.id, option.id)}
                            className="h-4 w-4 text-blue-600 cursor-pointer"
                          />
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
              onClick={() => setPageState('confirm')}
              disabled={!allQuestionsAnswered}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer transition-colors duration-200"
            >
              確認画面へ
            </button>
            {!allQuestionsAnswered && (
              <p className="text-sm text-red-500 text-center mt-2">
                すべての必須項目に回答してください
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
