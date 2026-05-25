'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { surveyAPI } from '../../../../lib/api';

interface SurveyOption {
  readonly id: number;
  readonly title: string;
  readonly require_registration?: boolean;
}

export default function NewSurveyPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('draft');
  const [registrationStartDate, setRegistrationStartDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [linkedRegistrationId, setLinkedRegistrationId] = useState<number | null>(null);
  const [availableSurveys, setAvailableSurveys] = useState<readonly SurveyOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSurveys = async () => {
      try {
        const surveys: SurveyOption[] = await surveyAPI.list();
        // 登録アンケート（require_registration=true）のみを候補に
        setAvailableSurveys(surveys.filter((s) => !!s.require_registration));
      } catch (error) {
        console.error('Failed to fetch surveys:', error);
      }
    };
    fetchSurveys();
  }, []);

  // `<input type="datetime-local">` のローカル時刻文字列（例: "2026-05-25T10:00"）を
  // ISO 8601 UTC（例: "2026-05-25T01:00:00.000Z"）に変換してから送信する。
  // そのまま送るとサーバー側で UTC として解釈され、表示時 JST 変換で 9 時間ズレる。
  const toISO = (local: string | null | undefined): string | null => {
    if (!local) return null;
    const d = new Date(local);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

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
        start_date: toISO(startDate),
        end_date: toISO(endDate),
        registration_start_date: toISO(registrationStartDate),
        registration_deadline: toISO(registrationDeadline),
        require_registration: false,
        registration_message: null,
        registration_fields: [],
      });

      // 1対N: 投票アンケートを既存登録アンケートに紐付ける（その登録アンケートの voting-links に追加）
      if (linkedRegistrationId) {
        const current = await surveyAPI.listVotingLinks(linkedRegistrationId);
        const merged = Array.from(new Set([...(current.voting_survey_ids || []), survey.id]));
        await surveyAPI.updateVotingLinks(linkedRegistrationId, merged);
      }

      router.push(`/admin/surveys/${survey.id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : '作成に失敗しました';
      alert(message);
    } finally {
      setLoading(false);
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
              &larr; 新規アンケート作成
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                rows={4}
                className={`${inputClass} resize-none leading-relaxed`}
              />
            </div>

            <div>
              <label htmlFor="status" className={labelClass}>
                ステータス
              </label>
              <select
                id="status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={`${inputClass} cursor-pointer`}
              >
                <option value="draft">下書き</option>
                <option value="published">公開中</option>
                <option value="closed">終了</option>
              </select>
            </div>

            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3">日程設定</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="registrationStartDate" className={labelClass}>
                    登録開始日時
                  </label>
                  <input
                    id="registrationStartDate"
                    type="datetime-local"
                    value={registrationStartDate}
                    onChange={(e) => setRegistrationStartDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="registrationDeadline" className={labelClass}>
                    登録締切日時
                  </label>
                  <input
                    id="registrationDeadline"
                    type="datetime-local"
                    value={registrationDeadline}
                    onChange={(e) => setRegistrationDeadline(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className={labelClass}>
                  投票開始日時
                </label>
                <input
                  id="startDate"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="endDate" className={labelClass}>
                  投票終了日時
                </label>
                <input
                  id="endDate"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6 mt-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4">
                紐づけ登録アンケート
              </h3>
              <select
                id="linkedRegistrationId"
                value={linkedRegistrationId ?? ''}
                onChange={(e) =>
                  setLinkedRegistrationId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className={`${inputClass} cursor-pointer`}
              >
                <option value="">なし（紐づけしない）</option>
                {availableSurveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => router.push('/admin/dashboard')}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {loading ? '作成中...' : '作成'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
