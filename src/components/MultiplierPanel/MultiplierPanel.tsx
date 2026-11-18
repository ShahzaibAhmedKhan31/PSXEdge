import { Lock } from 'lucide-react';
import { formatMultiplierAuto, formatPercent } from '../../utils/percentageFormatter';

interface MultiplierPanelProps {
  /** Derived multiplier: 100 ÷ sum of visible original weightages. */
  multiplier: number;
  /** Sum of original weightages across the visible companies. */
  weightTotal: number;
  selectedCount: number;
  totalCount: number;
}

/**
 * Read-only display of the derived multiplier. It is never typed in by the user:
 * it rebalances so the visible adjusted weightages always total 100%.
 */
export function MultiplierPanel({ multiplier, weightTotal, selectedCount, totalCount }: MultiplierPanelProps) {
  const hasSelection = selectedCount > 0;

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900 dark:text-white">
            Weighting multiplier
            <Lock className="h-3.5 w-3.5 text-ink-400 dark:text-ink-500" aria-hidden="true" />
          </h2>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">Automatic — not editable.</p>
        </div>
        <span className="rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400">
          Auto
        </span>
      </div>

      <div
        aria-live="polite"
        className="mt-3 flex h-12 items-center rounded-lg border border-ink-200 bg-ink-50/70 px-3 dark:border-ink-700 dark:bg-ink-950/60"
      >
        <span className="text-lg font-semibold tracking-tight tabular-nums text-ink-900 dark:text-white">
          {hasSelection ? formatMultiplierAuto(multiplier) : '—'}
        </span>
        <span className="ml-auto text-[11px] text-ink-500 dark:text-ink-400">
          {hasSelection ? `${selectedCount} of ${totalCount} selected` : 'No companies selected'}
        </span>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
        {hasSelection ? (
          <>
            Derived as 100 ÷ {formatPercent(weightTotal)} of selected index weight, so the adjusted weightages total
            exactly 100%.
          </>
        ) : (
          <>Widen the filters below to include at least one company.</>
        )}
      </p>
    </div>
  );
}
