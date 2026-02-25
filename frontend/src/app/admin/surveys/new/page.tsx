'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { surveyAPI } from '../../../../lib/api';

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
    if (!title.trim()) { alert('タイトルを入力してください'); return; }
    setLoading(true);
    try {
      const survey = await surveyAPI.create({
        title, description, status,
        start_date: startDate || null, end_date: endDate || null,
        require_registration: requireRegistration,
        registration_message: registrationMessage || null,
        registration_deadline: registrationDeadline || null,
        registration_fields: registrationFields.filter((f) => f.name.trim() !== ''),
        linked_voting_survey_id: null,
      });
      router.push(`/admin/surveys/${survey.id}`);
    } catch (err: any) { alert(err.response?.data?.error || '作成に失敗しました'); }
    finally { setLoading(false); }
  };

  const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800";
  const labelClass = "block text-sm font-medium text-slate-600 mb-1.5";

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-4">
            <button onClick={() => router.push('/admin/dashboard')} className="text-primary-600 hover:text-primary-700 text-sm cursor-pointer transition-colors">
              ← 一覧に戻る
            </button>
            <h1 className="font-bold text-slate-800">アンケートを作成</h1>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 animate-fade-in">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="title" className={labelClass}>タイトル <span className="text-red-500">*</span></label>
              <input id="title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
            </div>

            <div>
              <label htmlFor="description" className={labelClass}>説明</label>
              <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={`${inputClass} resize-none leading-relaxed`} />
            </div>

            <div>
              <label htmlFor="status" className={labelClass}>ステータス</label>
              <select id="status" value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} cursor-pointer`}>
                <option value="draft">下書き</option>
                <option value="published">公開中</option>
                <option value="closed">終了</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="startDate" className={labelClass}>開始日時</label>
                <input id="startDate" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="endDate" className={labelClass}>終了日時</label>
                <input id="endDate" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="border-t border-slate-100 pt-6 mt-6">
              <h3 className="text-sm font-bold text-slate-800 mb-4">メール認証投票設定</h3>
              <label className="flex items-center gap-2.5 cursor-pointer mb-4">
                <input type="checkbox" id="require_registration" checked={requireRegistration} onChange={(e) => setRequireRegistration(e.target.checked)} className="w-4 h-4 text-primary-600 rounded border-slate-300 cursor-pointer" />
                <span className="text-sm text-slate-600">メール登録を必須にする</span>
              </label>

              {requireRegistration && (
                <div className="ml-6 space-y-4 border-l-2 border-primary-100 pl-4">
                  <div>
                    <label htmlFor="registrationMessage" className={labelClass}>登録案内メッセージ</label>
                    <textarea id="registrationMessage" value={registrationMessage} onChange={(e) => setRegistrationMessage(e.target.value)} className={`${inputClass} resize-none text-sm leading-relaxed`} rows={3} placeholder="投票に参加するにはメールアドレスの登録が必要です。" />
                  </div>
                  <div>
                    <label htmlFor="registrationDeadline" className={labelClass}>登録締め切り日時</label>
                    <input id="registrationDeadline" type="datetime-local" value={registrationDeadline} onChange={(e) => setRegistrationDeadline(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>登録フォームの入力項目</label>
                    <p className="text-xs text-slate-400 mb-3">メールアドレスに加えて、投票者に入力してもらう項目を設定できます。</p>
                    <div className="space-y-2 mb-3">
                      {registrationFields.map((field, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input type="text" value={field.name} onChange={(e) => { const f = [...registrationFields]; f[index] = { ...f[index], name: e.target.value }; setRegistrationFields(f); }} className={`flex-1 ${inputClass}`} placeholder="項目名（例: 学校名）" />
                          <label className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                            <input type="checkbox" checked={field.required || false} onChange={(e) => { const f = [...registrationFields]; f[index] = { ...f[index], required: e.target.checked }; setRegistrationFields(f); }} className="h-3.5 w-3.5 cursor-pointer" />必須
                          </label>
                          <button type="button" onClick={() => setRegistrationFields(registrationFields.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-600 text-xs px-2 py-1 cursor-pointer transition-colors">削除</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setRegistrationFields([...registrationFields, { name: '', required: false }])} className="text-xs text-primary-600 hover:text-primary-700 py-1 cursor-pointer transition-colors">+ 項目を追加</button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 disabled:opacity-50 cursor-pointer transition-colors">
                {loading ? '作成中...' : '作成'}
              </button>
              <button type="button" onClick={() => router.push('/admin/dashboard')} className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 cursor-pointer transition-colors">キャンセル</button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
