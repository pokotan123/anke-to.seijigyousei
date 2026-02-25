'use client';

import { useRouter } from 'next/navigation';

interface SurveyTypeSelectorModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SurveyTypeSelectorModal({ open, onClose }: SurveyTypeSelectorModalProps) {
  const router = useRouter();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="アンケートタイプ選択"
    >
      <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-md animate-fade-in">
        <h3 className="text-lg font-bold text-slate-800 mb-2">新規アンケート作成</h3>
        <p className="text-sm text-slate-500 mb-6">作成するアンケートのタイプを選択してください</p>

        <div className="space-y-3">
          <button
            onClick={() => { onClose(); router.push('/admin/surveys/new'); }}
            className="w-full flex items-center gap-4 p-4 border border-slate-200 rounded-xl hover:border-primary-300 hover:bg-primary-50/50 cursor-pointer transition-all text-left"
          >
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">投票アンケート</div>
              <div className="text-xs text-slate-500 mt-0.5">質問と選択肢を設定して投票を収集します</div>
            </div>
          </button>

          <button
            onClick={() => { onClose(); router.push('/admin/surveys/new/registration'); }}
            className="w-full flex items-center gap-4 p-4 border border-slate-200 rounded-xl hover:border-teal-300 hover:bg-teal-50/50 cursor-pointer transition-all text-left"
          >
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">登録アンケート</div>
              <div className="text-xs text-slate-500 mt-0.5">参加者情報を収集して投票リンクを発行します</div>
            </div>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
