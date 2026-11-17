import { INDEX_KEYS, INDEX_META } from '../../data/indexMeta';
import { cn } from '../../lib/cn';
import type { IndexKey } from '../../types';

interface IndexSelectorProps {
  value: IndexKey;
  onChange: (index: IndexKey) => void;
}

export function IndexSelector({ value, onChange }: IndexSelectorProps) {
  return (
    <div
      role="tablist"
      aria-label="Select a PSX index"
      className="grid w-full grid-cols-2 gap-1 rounded-xl border border-ink-200/80 bg-ink-100/60 p-1 dark:border-ink-800/80 dark:bg-ink-900/60 sm:w-auto"
    >
      {INDEX_KEYS.map((key) => {
        const meta = INDEX_META[key];
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:justify-start',
              active
                ? 'bg-white text-ink-900 shadow-sm ring-1 ring-black/[0.03] dark:bg-ink-800 dark:text-white dark:ring-white/5'
                : 'text-ink-500 hover:bg-white/60 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800/60 dark:hover:text-ink-100',
            )}
          >
            <span className="text-sm font-semibold tracking-tight">{meta.label}</span>
            <span
              className={cn(
                'hidden text-[10px] font-medium uppercase tracking-wide sm:inline',
                active ? 'text-brand-600 dark:text-brand-400' : 'text-ink-400 dark:text-ink-500',
              )}
            >
              Top {meta.topN}
            </span>
          </button>
        );
      })}
    </div>
  );
}
