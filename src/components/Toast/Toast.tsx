import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'border-brand-200 bg-white text-ink-900 dark:border-brand-500/30 dark:bg-ink-900 dark:text-ink-100',
  error: 'border-red-200 bg-white text-ink-900 dark:border-red-500/30 dark:bg-ink-900 dark:text-ink-100',
  info: 'border-ink-200 bg-white text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100',
};

const ICONS = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
} as const;

const ICON_COLORS: Record<ToastTone, string> = {
  success: 'text-brand-600 dark:text-brand-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-ink-500 dark:text-ink-400',
};

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const Icon = ICONS[toast.tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-start gap-3 rounded-xl border p-3.5 shadow-pop animate-fade-in sm:left-auto sm:right-4 sm:translate-x-0',
        TONE_STYLES[toast.tone],
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ICON_COLORS[toast.tone])} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-500 dark:text-ink-400">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
