'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * カスタム確認ダイアログ
 *
 * window.confirm() の代替。ブラウザの「このページのダイアログを表示しない」
 * 設定や拡張機能で抑止されない、確実に表示される独自モーダル。
 *
 * 使い方:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: '質問を削除', message: 'この質問を削除しますか？', danger: true });
 *   if (!ok) return;
 */

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type Resolver = (result: boolean) => void;

interface ConfirmContextValue {
  request: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used inside <ConfirmProvider>');
  }
  return ctx.request;
}

interface PendingState {
  options: ConfirmOptions;
  resolver: Resolver;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  const pendingRef = useRef<PendingState | null>(null);
  pendingRef.current = pending;

  const request = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolver: resolve });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    current.resolver(result);
    setPending(null);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close(false);
      } else if (e.key === 'Enter') {
        close(true);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={{ request }}>
      {children}
      {pending && (
        <ConfirmDialog
          options={pending.options}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

interface ConfirmDialogProps {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ options, onConfirm, onCancel }: ConfirmDialogProps) {
  const { title, message, confirmLabel = 'OK', cancelLabel = 'キャンセル', danger = false } = options;

  const confirmClass = danger
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-primary-600 hover:bg-primary-700';

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      data-testid="confirm-dialog"
    >
      <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-md animate-fade-in">
        <h3 id="confirm-dialog-title" className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-6 whitespace-pre-line leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            data-testid="confirm-dialog-ok"
            className={`flex-1 px-4 py-2.5 text-white text-sm font-semibold rounded-lg cursor-pointer transition-colors ${confirmClass}`}
            autoFocus
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            data-testid="confirm-dialog-cancel"
            className="px-4 py-2.5 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 cursor-pointer transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
