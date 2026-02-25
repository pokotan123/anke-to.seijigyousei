'use client';

import type { Question } from '../../lib/types';

interface QuestionModalProps {
  question: Question;
  onChange: (question: Question) => void;
  onSave: () => void;
  onClose: () => void;
}

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800';
const labelClass = 'block text-sm font-medium text-slate-600 mb-1.5';

export default function QuestionModal({ question, onChange, onSave, onClose }: QuestionModalProps) {
  const titleId = 'question-modal-title';

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
        <h3 id={titleId} className="text-lg font-bold text-slate-800 mb-5">
          {question.id === 0 ? '質問を追加' : '質問を編集'}
        </h3>
        <div className="space-y-5">
          <div>
            <label htmlFor="questionText" className={labelClass}>
              質問文 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="questionText"
              value={question.question_text}
              onChange={(e) => onChange({ ...question, question_text: e.target.value })}
              rows={3}
              className={`${inputClass} resize-none leading-relaxed`}
              required
            />
          </div>
          <div>
            <label htmlFor="questionType" className={labelClass}>
              質問タイプ <span className="text-red-500">*</span>
            </label>
            <select
              id="questionType"
              value={question.question_type}
              onChange={(e) =>
                onChange({
                  ...question,
                  question_type: e.target.value as Question['question_type'],
                  options: (e.target.value === 'text' || e.target.value === 'email') ? [] : question.options,
                })
              }
              className={`${inputClass} cursor-pointer`}
            >
              <option value="single_choice">単一選択</option>
              <option value="multiple_choice">複数選択</option>
              <option value="text">自由記述</option>
              <option value="email">メールアドレス</option>
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={question.is_required}
                onChange={(e) => onChange({ ...question, is_required: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded border-slate-300 cursor-pointer"
              />
              <span className="text-sm text-slate-600">必須質問</span>
            </label>
          </div>
          <div>
            <label htmlFor="questionOrder" className={labelClass}>表示順序</label>
            <input
              id="questionOrder"
              type="number"
              value={question.order}
              onChange={(e) => onChange({ ...question, order: parseInt(e.target.value) || 0 })}
              className={inputClass}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onSave}
            className="flex-1 px-4 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 cursor-pointer transition-colors"
          >
            保存
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
