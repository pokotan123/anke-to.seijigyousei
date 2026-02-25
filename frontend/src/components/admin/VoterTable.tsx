'use client';

import { voterStatusLabels, formatDate } from '../../lib/formatters';

interface Voter {
  id: number;
  email: string;
  status: string;
  registered_at: string | null;
  link_sent_at: string | null;
  voted_at: string | null;
  reminder_sent_at: string | null;
  registration_data: Record<string, string> | null;
}

interface VoterTableProps {
  voters: Voter[];
  fields?: { name: string; required: boolean }[];
  loading?: boolean;
}

export default function VoterTable({ voters, fields = [], loading }: VoterTableProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          <span className="ml-3 text-sm text-slate-400">読み込み中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500">メール</th>
              {fields.map((field) => (
                <th key={field.name} scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                  {field.name}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500">ステータス</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500">登録日時</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500">投票日時</th>
            </tr>
          </thead>
          <tbody>
            {voters.length === 0 ? (
              <tr>
                <td colSpan={fields.length + 4} className="px-4 py-16 text-center">
                  <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                  <p className="text-sm text-slate-400">投票者がまだ登録されていません</p>
                  <p className="text-xs text-slate-400 mt-1">登録URLを配布して投票者を集めてください</p>
                </td>
              </tr>
            ) : (
              voters.map((voter) => (
                <tr key={voter.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-800">{voter.email}</td>
                  {fields.map((field) => (
                    <td key={field.name} className="px-4 py-3 text-sm text-slate-600">
                      {voter.registration_data?.[field.name] || '-'}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${voterStatusLabels[voter.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                      {voterStatusLabels[voter.status]?.label || voter.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDate(voter.registered_at)}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{formatDate(voter.voted_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
