'use client';

import Link from 'next/link';

interface AdminHeaderProps {
  onLogout: () => void;
  activePage?: 'dashboard' | 'voters' | 'analytics' | 'votes' | 'audit-logs';
}

export default function AdminHeader({ onLogout, activePage }: AdminHeaderProps) {
  const linkClass = (page: string) =>
    activePage === page
      ? 'text-primary-600 font-medium'
      : 'text-slate-500 hover:text-primary-600 transition-colors';

  return (
    <nav className="bg-white border-b border-slate-200" aria-label="管理メニュー">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between h-14">
          <div className="flex items-center gap-1">
            <svg className="w-5 h-5 text-primary-600 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <Link href="/admin/dashboard" className="font-bold text-slate-800">アンケート管理</Link>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/admin/voters" className={linkClass('voters')}>投票者管理</Link>
            <Link href="/admin/analytics" className={linkClass('analytics')}>分析</Link>
            <Link href="/admin/votes" className={linkClass('votes')}>投票データ</Link>
            <Link href="/admin/audit-logs" className={linkClass('audit-logs')}>監査ログ</Link>
            <button onClick={onLogout} className="text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">ログアウト</button>
          </div>
        </div>
      </div>
    </nav>
  );
}
