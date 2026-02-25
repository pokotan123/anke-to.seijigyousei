'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { surveyAPI, authAPI } from '../../../../lib/api';

export default function NewSurveyPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [requireRegistration, setRequireRegistration] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [registrationFields, setRegistrationFields] = useState<{ name: string; required: boolean }[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }

    setLoading(true);
    try {
      const survey = await surveyAPI.create({
        title,
        description,
        status,
        start_date: startDate || null,
        end_date: endDate || null,
        require_registration: requireRegistration,
        registration_message: registrationMessage || null,
        registration_deadline: registrationDeadline || null,
        registration_fields: registrationFields.filter((f) => f.name.trim() !== ''),
      });
      router.push(`/admin/surveys/${survey.id}`);
    } catch (err: any) {
      alert(err.response?.data?.error || '作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="text-blue-600 hover:text-blue-800 cursor-pointer transition-colors duration-200 py-2 px-1"
              >
                ← 一覧に戻る
              </button>
              <h1 className="text-xl font-bold text-gray-900">アンケートを作成</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white shadow rounded-lg p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  タイトル <span className="text-red-500">*</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  説明
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 leading-relaxed"
                />
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                  ステータス
                </label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="draft">下書き</option>
                  <option value="published">公開中</option>
                  <option value="closed">終了</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                    開始日時
                  </label>
                  <input
                    id="startDate"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                    終了日時
                  </label>
                  <input
                    id="endDate"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* メール認証投票設定 */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">メール認証投票設定</h3>

                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="require_registration"
                    checked={requireRegistration}
                    onChange={(e) => setRequireRegistration(e.target.checked)}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 cursor-pointer"
                  />
                  <label htmlFor="require_registration" className="text-sm font-medium text-gray-700">
                    メール登録を必須にする
                  </label>
                </div>

                {requireRegistration && (
                  <div className="ml-7 space-y-4">
                    <div>
                      <label htmlFor="registrationMessage" className="block text-sm font-medium text-gray-700 mb-1">
                        登録案内メッセージ
                      </label>
                      <textarea
                        id="registrationMessage"
                        value={registrationMessage}
                        onChange={(e) => setRegistrationMessage(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 leading-relaxed"
                        rows={3}
                        placeholder="投票に参加するにはメールアドレスの登録が必要です。"
                      />
                    </div>
                    <div>
                      <label htmlFor="registrationDeadline" className="block text-sm font-medium text-gray-700 mb-1">
                        登録締め切り日時
                      </label>
                      <input
                        id="registrationDeadline"
                        type="datetime-local"
                        value={registrationDeadline}
                        onChange={(e) => setRegistrationDeadline(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {/* カスタム登録項目 */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        登録フォームの入力項目
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        メールアドレスに加えて、投票者に入力してもらう項目を設定できます。
                      </p>
                      <div className="space-y-2 mb-3">
                        {registrationFields.map((field, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={field.name}
                              onChange={(e) => {
                                const fields = [...registrationFields];
                                fields[index] = { ...fields[index], name: e.target.value };
                                setRegistrationFields(fields);
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                              placeholder="項目名（例: 学校名）"
                            />
                            <label className="flex items-center gap-1 text-sm text-gray-600 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={field.required || false}
                                onChange={(e) => {
                                  const fields = [...registrationFields];
                                  fields[index] = { ...fields[index], required: e.target.checked };
                                  setRegistrationFields(fields);
                                }}
                                className="h-3.5 w-3.5 cursor-pointer"
                              />
                              必須
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const fields = registrationFields.filter((_, i) => i !== index);
                                setRegistrationFields(fields);
                              }}
                              className="text-red-500 hover:text-red-700 text-sm py-1.5 px-3 cursor-pointer transition-colors duration-200"
                            >
                              削除
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRegistrationFields([...registrationFields, { name: '', required: false }]);
                        }}
                        className="text-sm text-blue-600 hover:text-blue-800 py-2 px-3 cursor-pointer transition-colors duration-200"
                      >
                        + 項目を追加
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-4 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors duration-200"
                >
                  {loading ? '作成中...' : '作成'}
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/admin/dashboard')}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 cursor-pointer transition-colors duration-200"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
