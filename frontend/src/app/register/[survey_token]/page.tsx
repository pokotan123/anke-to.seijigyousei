'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { surveyAPI, voterAPI } from '../../../lib/api';

interface RegistrationField {
  name: string;
  required: boolean;
}

interface SurveyInfo {
  title: string;
  description: string;
  registration_deadline: string | null;
  registration_fields?: RegistrationField[];
  registration_message?: string;
}

type PageState = 'loading' | 'form' | 'success' | 'not_found';

export default function RegisterPage() {
  const params = useParams();
  const surveyToken = params.survey_token as string;

  const [surveyInfo, setSurveyInfo] = useState<SurveyInfo | null>(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        const data = await surveyAPI.getByToken(surveyToken);
        setSurveyInfo({
          title: data.title,
          description: data.description,
          registration_deadline: data.registration_deadline ?? null,
          registration_fields: data.registration_fields,
          registration_message: data.registration_message,
        });
        setPageState('form');
      } catch (err: unknown) {
        const axiosError = err as { response?: { data?: { error?: string } } };
        const message =
          axiosError.response?.data?.error || 'アンケートが見つかりません';
        setErrorMessage(message);
        setPageState('not_found');
      }
    };

    if (surveyToken) {
      fetchSurvey();
    }
  }, [surveyToken]);

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value) {
      setEmailError('メールアドレスを入力してください。');
      return false;
    }
    if (!emailRegex.test(value)) {
      setEmailError('有効なメールアドレスを入力してください。');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError) {
      validateEmail(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setErrorMessage('');

    if (!validateEmail(email)) {
      return;
    }

    setIsSubmitting(true);

    try {
      await voterAPI.register(surveyToken, email);
      setPageState('success');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      const message =
        axiosError.response?.data?.error ||
        '登録に失敗しました。もう一度お試しください。';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ローディング画面
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div
            role="status"
            aria-label="読み込み中"
            className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"
          />
          <p className="text-gray-600 leading-relaxed">読み込み中...</p>
        </div>
      </div>
    );
  }

  // アンケートが見つからない画面
  if (pageState === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            アンケートが見つかりません
          </h2>
          <p className="text-gray-600 leading-relaxed">{errorMessage}</p>
        </div>
      </div>
    );
  }

  // 成功画面
  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            登録が完了しました
          </h2>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            <p className="leading-relaxed">
              投票リンクは後日メールでお届けします。
              <br />
              メールが届くまでしばらくお待ちください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  // フォーム画面
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8">
        {/* ヘッダー */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">投票者登録</h1>
        </div>

        {/* アンケート情報 */}
        {surveyInfo && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h2 className="font-semibold text-gray-900 mb-1">
              {surveyInfo.title}
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {surveyInfo.description}
            </p>
            {surveyInfo.registration_deadline && (
              <p className="text-xs text-gray-500 mt-2">
                登録締切:{' '}
                {new Date(surveyInfo.registration_deadline).toLocaleDateString(
                  'ja-JP',
                  {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }
                )}
              </p>
            )}
            {surveyInfo.registration_message && (
              <p className="text-sm text-gray-700 mt-2 leading-relaxed">
                {surveyInfo.registration_message}
              </p>
            )}
          </div>
        )}

        {/* エラー表示 */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        {/* フォーム */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              メールアドレス
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onBlur={() => validateEmail(email)}
              placeholder="example@email.com"
              required
              aria-describedby={emailError ? 'email-error' : undefined}
              aria-invalid={emailError ? true : undefined}
              className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-colors duration-200 ${
                emailError
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-300'
              }`}
            />
            {emailError && (
              <p id="email-error" className="text-sm text-red-600 mt-1">
                {emailError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !email}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span
                  role="status"
                  aria-label="送信中"
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                />
                登録中...
              </span>
            ) : (
              '登録する'
            )}
          </button>
        </form>

        <p className="text-xs text-gray-500 text-center mt-4 leading-relaxed">
          登録したメールアドレスに投票リンクが送信されます。
        </p>
      </div>
    </div>
  );
}
