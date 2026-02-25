'use client';

import type { Option } from '../../lib/types';

interface OptionModalProps {
  option: Option;
  isNew: boolean;
  onChange: (option: Option) => void;
  onSave: () => void;
  onClose: () => void;
}

const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800';
const labelClass = 'block text-sm font-medium text-slate-600 mb-1.5';

export default function OptionModal({ option, isNew, onChange, onSave, onClose }: OptionModalProps) {
  const titleId = 'option-modal-title';

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-md animate-fade-in">
        <h3 id={titleId} className="text-lg font-bold text-slate-800 mb-5">
          {isNew ? '選択肢を追加' : '選択肢を編集'}
        </h3>
        <div className="space-y-5">
          <div>
            <label htmlFor="optionText" className={labelClass}>
              選択肢テキスト <span className="text-red-500">*</span>
            </label>
            <input
              id="optionText"
              type="text"
              value={option.option_text}
              onChange={(e) => onChange({ ...option, option_text: e.target.value })}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="optionOrder" className={labelClass}>表示順序</label>
            <input
              id="optionOrder"
              type="number"
              value={option.order}
              onChange={(e) => onChange({ ...option, order: parseInt(e.target.value) || 0 })}
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
