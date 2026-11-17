import { AlertTriangle } from 'lucide-react';
import { formatPKR } from '../../utils/currencyFormatter';
import { formatPercent } from '../../utils/percentageFormatter';
import type { InvestmentTotals } from '../../types/investment';

interface OverAllocationAlertProps {
  totals: InvestmentTotals;
}

export function OverAllocationAlert({ totals }: OverAllocationAlertProps) {
  if (!totals.isOverAllocated) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="text-sm">
        <p className="font-semibold">Over-allocated by {formatPKR(totals.overAllocatedBy)}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-amber-800 dark:text-amber-200/80">
          Adjusted weightages total {formatPercent(totals.adjustedWeightage)}, so this plan commits{' '}
          {formatPercent(totals.adjustedWeightage - 100)} more than your budget. PSXEdge never normalises or changes your
          inputs — lower the multiplier, increase the amount, or fund the shortfall.
        </p>
      </div>
    </div>
  );
}
