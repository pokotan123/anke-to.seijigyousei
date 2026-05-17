'use client';

import Link from 'next/link';
import { statusLabel, statusColor } from '../../lib/formatters';
import type { SurveyListItem } from '../../lib/types';

interface SurveyCardProps {
  survey: SurveyListItem;
  type: 'voting' | 'registration';
  linkedSurvey?: SurveyListItem;
  onDelete: (surveyId: number, surveyTitle: string, e: React.MouseEvent) => void;
  onExportCSV: (surveyId: number, surveyTitle: string, e: React.MouseEvent) => void;
  onDuplicate: (surveyId: number, surveyTitle: string, e: React.MouseEvent) => void;
  onVoters?: (surveyId: number, e: React.MouseEvent) => void;
}

export default function SurveyCard({ survey, type, linkedSurvey, onDelete, onExportCSV, onDuplicate, onVoters }: SurveyCardProps) {
  const urlPrefix = type === 'voting' ? 'vote' : 'register';
  const accentColor = type === 'voting' ? 'primary' : 'teal';

  return (
    <Link href={`/admin/surveys/${survey.id}`} className="block bg-white rounded-xl border border-slate-200/80 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-2">
            <svg className={`w-4 h-4 text-${accentColor}-500 shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              {type === 'voting' ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              )}
            </svg>
            <h3 className="font-semibold text-slate-800 truncate">{survey.title}</h3>
            <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full border ${statusColor(survey.status)}`}>
              {statusLabel(survey.status)}
            </span>
          </div>
          <p className="text-xs text-slate-400 font-mono break-all mb-1">
            {typeof window !== 'undefined' && `${window.location.origin}/${urlPrefix}/${survey.unique_token}`}
          </p>
          {linkedSurvey && (
            <p className={`text-xs text-${accentColor}-600 mt-1.5`}>
              {type === 'voting' ? `登録アンケート: ${linkedSurvey.title}` : `紐づけ先: ${linkedSurvey.title}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400">
            {new Date(survey.created_at).toLocaleDateString('ja-JP')}
          </span>
          {type === 'voting' && onVoters && (
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onVoters(survey.id, e); }}
              className="px-2.5 py-1.5 text-xs text-primary-600 hover:bg-primary-50 rounded-md border border-primary-200 cursor-pointer transition-colors"
            >
              投票者
            </button>
          )}
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onExportCSV(survey.id, survey.title, e); }}
            className="px-2.5 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 rounded-md border border-emerald-200 cursor-pointer transition-colors"
          >
            CSV
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDuplicate(survey.id, survey.title, e); }}
            className="px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md border border-slate-200 cursor-pointer transition-colors"
          >
            複製
          </button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(survey.id, survey.title, e); }}
            className="px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-md border border-red-200 cursor-pointer transition-colors"
          >
            削除
          </button>
        </div>
      </div>
    </Link>
  );
}
