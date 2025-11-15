'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { surveyAPI, voteAPI } from '../../../lib/api';
// UUID生成の簡易実装（本番環境ではuuidライブラリを使用）
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

interface Option {
  id: number;
  option_text: string;
}

interface Survey {
  id: number;
  title: string;
  description: string;
  questions: Question[];
}

export default function VotePage() {
  const params = useParams();
  const token = params.token as string;
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, number | number[] | string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('session_id');
      if (!id) {
        id = generateUUID();
        localStorage.setItem('session_id', id);
      }
      return id;
    }
    return generateUUID();
  });

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const data = await surveyAPI.getByToken(token);
        setSurvey(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'アンケートが見つかりません');
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchSurvey();
    }
  }, [token]);

  const handleAnswerChange = (questionId: number, value: number | number[] | string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const questionIds = survey?.questions.map((q) => q.id) || [];
      
      // 必須質問のチェック
      for (const question of survey?.questions || []) {
        if (question.is_required && !answers[question.id]) {
          alert(`「${question.question_text}」は必須です`);
          setSubmitting(false);
          return;
        }
      }

      // 各質問に対して投票を送信
      if (!survey) {
        alert('アンケートが見つかりません');
        setSubmitting(false);
        return;
      }

      for (const questionId of questionIds) {
        const answer = answers[questionId];
        if (!answer) continue;

        const question = survey.questions.find((q) => q.id === questionId);
        if (!question) continue;

        if (question.question_type === 'text') {
          await voteAPI.submit(
            {
              survey_token: token,
              question_id: questionId,
              answer_text: answer,
            },
            sessionId
          );
        } else if (Array.isArray(answer)) {
          // 複数選択
          for (const optionId of answer) {
            await voteAPI.submit(
              {
                survey_token: token,
                question_id: questionId,
                option_id: optionId,
              },
              sessionId
            );
          }
        } else {
          // 単一選択
          await voteAPI.submit(
            {
              survey_token: token,
              question_id: questionId,
              option_id: answer,
            },
            sessionId
          );
        }
      }

      setSubmitted(true);
    } catch (err: any) {
      alert(err.response?.data?.error || '投票の送信に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-xl mb-4">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg">
          <div className="text-6xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">投票ありがとうございました</h2>
          <p className="text-gray-600">ご回答いただき、ありがとうございます。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{survey?.title}</h1>
          {survey?.description && (
            <p className="text-gray-600 mb-8">{survey.description}</p>
          )}

          <form onSubmit={handleSubmit}>
            {survey?.questions.map((question, index) => (
              <div key={question.id} className="mb-8">
                <label className="block text-lg font-semibold text-gray-900 mb-3">
                  {index + 1}. {question.question_text}
                  {question.is_required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>

                {question.question_type === 'text' ? (
                  <textarea
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    value={(answers[question.id] as string) || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    required={question.is_required}
                  />
                ) : question.question_type === 'multiple_choice' ? (
                  <div className="space-y-2">
                    {question.options?.map((option) => (
                      <label key={option.id} className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mr-3"
                          checked={(answers[question.id] as number[])?.includes(option.id) || false}
                          onChange={(e) => {
                            const current = (answers[question.id] as number[]) || [];
                            if (e.target.checked) {
                              handleAnswerChange(question.id, [...current, option.id]);
                            } else {
                              handleAnswerChange(question.id, current.filter((id) => id !== option.id));
                            }
                          }}
                        />
                        <span>{option.option_text}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {question.options?.map((option) => (
                      <label key={option.id} className="flex items-center p-3 border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          className="mr-3"
                          value={option.id}
                          checked={(answers[question.id] as number) === option.id}
                          onChange={(e) => handleAnswerChange(question.id, parseInt(e.target.value))}
                          required={question.is_required}
                        />
                        <span>{option.option_text}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '送信中...' : '投票する'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

