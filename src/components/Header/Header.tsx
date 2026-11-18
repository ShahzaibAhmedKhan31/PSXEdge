import { RefreshCw, TrendingUp } from 'lucide-react';
import { INDEX_META } from '../../data/indexMeta';
import { cn } from '../../lib/cn';
import { formatTimestamp } from '../../services/indexDataService';
import type { IndexKey } from '../../types';
import { ExportButton } from '../ExportButton/ExportButton';
import { IndexSelector } from '../IndexSelector/IndexSelector';
import { ThemeToggle } from '../ThemeToggle/ThemeToggle';
import type { Theme } from '../../hooks/useTheme';

interface HeaderProps {
  index: IndexKey;
  onIndexChange: (index: IndexKey) => void;
  theme: Theme;
  onToggleTheme: () => void;
  lastUpdated: string;
  refreshing: boolean;
  onRefresh: () => void;
  onExport: () => void;
  exporting: boolean;
}

export function Header({
  index,
  onIndexChange,
  theme,
  onToggleTheme,
  lastUpdated,
  refreshing,
  onRefresh,
  onExport,
  exporting,
}: HeaderProps) {
  const meta = INDEX_META[index];

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/80 bg-white/85 backdrop-blur-xl dark:border-ink-800/80 dark:bg-ink-950/85">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center gap-3 sm:h-16">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white shadow-sm">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="leading-tight">
              <h1 className="text-base font-semibold tracking-tight text-ink-900 dark:text-white">PSXEdge</h1>
              <p className="hidden text-[11px] text-ink-500 dark:text-ink-400 sm:block">
                Smarter Allocation. Simpler Investing.
              </p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="mr-1 hidden text-right lg:block">
              <div className="text-[10px] font-medium uppercase tracking-wider text-ink-400 dark:text-ink-500">
                Data updated
              </div>
              <div className="text-xs font-medium tabular-nums text-ink-600 dark:text-ink-300">
                {formatTimestamp(lastUpdated)}
              </div>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label="Refresh index data"
              title="Fetch fresh data through the /psx proxy, then fall back to the last validated dataset."
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ink-200 bg-white text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-wait disabled:opacity-70 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
            </button>

            <ThemeToggle theme={theme} onToggle={onToggleTheme} />

            <ExportButton onClick={onExport} exporting={exporting} />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-ink-200/70 py-2.5 dark:border-ink-800/70 sm:flex-row sm:items-center sm:justify-between">
          <IndexSelector value={index} onChange={onIndexChange} />
          <p className="text-[11px] text-ink-500 dark:text-ink-400 sm:text-xs">
            <span className="font-medium text-ink-600 dark:text-ink-300">{meta.label}</span> · top {meta.topN} by index
            weight · default multiplier{' '}
            <span className="font-medium tabular-nums text-ink-600 dark:text-ink-300">
              ×{meta.defaultMultiplier.toFixed(2)}
            </span>
          </p>
        </div>
      </div>
    </header>
  );
}
