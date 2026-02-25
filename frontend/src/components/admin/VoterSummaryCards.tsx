'use client';

import type { VoterSummary } from '../../lib/types';

interface VoterSummaryCardsProps {
  summary: VoterSummary;
  loading?: boolean;
}

export default function VoterSummaryCards({ summary, loading }: VoterSummaryCardsProps) {
  const items = [
    { label: '合計', value: summary.total, color: 'text-slate-800' },
    { label: '登録済み', value: summary.registered, color: 'text-slate-500' },
    { label: '送信済み', value: summary.sent, color: 'text-primary-600' },
    { label: '投票済み', value: summary.voted, color: 'text-emerald-600' },
    { label: '期限切れ', value: summary.expired, color: 'text-red-500' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {items.map((item) => (
        <div key={item.label} className="bg-white rounded-xl border border-slate-200/80 p-4 text-center">
          <div className={`text-2xl font-bold ${item.color}`}>{loading ? '-' : item.value}</div>
          <div className="text-xs text-slate-400 mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
