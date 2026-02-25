export const statusLabel = (s: string) =>
  s === 'draft' ? '下書き' : s === 'published' ? '公開中' : '終了';

export const statusColor = (s: string) =>
  s === 'published'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : s === 'draft'
      ? 'bg-slate-50 text-slate-600 border-slate-200'
      : 'bg-red-50 text-red-600 border-red-200';

export const voterStatusLabels: Record<string, { label: string; color: string }> = {
  registered: { label: '登録済み', color: 'bg-slate-100 text-slate-600' },
  sent: { label: '送信済み', color: 'bg-primary-50 text-primary-700' },
  voted: { label: '投票済み', color: 'bg-emerald-50 text-emerald-700' },
  expired: { label: '期限切れ', color: 'bg-red-50 text-red-600' },
};

export const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const questionTypeLabel = (type: string) => {
  switch (type) {
    case 'single_choice': return '単一選択';
    case 'multiple_choice': return '複数選択';
    case 'text': return '自由記述';
    case 'email': return 'メールアドレス';
    default: return type;
  }
};
