import { Coins, PieChart, Scale, Wallet } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatPKR } from '../../utils/currencyFormatter';
import { formatMultiplierAuto, formatPercent } from '../../utils/percentageFormatter';
import type { InvestmentTotals } from '../../types/investment';

interface InvestmentSummaryProps {
  totals: InvestmentTotals;
}

export function InvestmentSummary({ totals }: InvestmentSummaryProps) {
  const remainingLabel = totals.isOverAllocated ? 'Over-allocated' : 'Remaining cash';
  // Shown as a positive magnitude: the card is already labelled "Over-allocated".
  const remainingValue = totals.isOverAllocated ? totals.overAllocatedBy : totals.remainingCash;

  const cards = [
    {
      label: 'Total investment',
      value: formatPKR(totals.totalInvestment),
      hint: totals.totalInvestment > 0 ? 'Your allocation budget' : 'Enter an amount above',
      icon: Wallet,
      tone: 'default' as const,
    },
    {
      label: 'Adjusted weightage',
      value: formatPercent(totals.adjustedWeightage),
      hint:
        totals.companyCount > 0
          ? `Normalised to 100% · auto multiplier ${formatMultiplierAuto(totals.multiplier)}`
          : 'No companies selected',
      icon: Scale,
      tone: 'default' as const,
    },
    {
      label: 'Total allocated',
      value: formatPKR(totals.allocatedAmount),
      hint: `${totals.companyCount} ${totals.companyCount === 1 ? 'company' : 'companies'} · fully invested`,
      icon: PieChart,
      tone: 'default' as const,
    },
    {
      label: remainingLabel,
      value: formatPKR(remainingValue),
      hint: totals.isOverAllocated
        ? `Adjusted weights exceed 100% by ${formatPercent(totals.adjustedWeightage - 100)}`
        : totals.remainingCash < 1
          ? 'Fully allocated — only rounding residue'
          : 'Unallocated part of your budget',
      icon: Coins,
      tone: totals.isOverAllocated ? ('danger' as const) : ('positive' as const),
    },
  ];

  return (
    <section aria-label="Investment summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={cn(
              'rounded-xl border bg-white p-4 shadow-card dark:bg-ink-900',
              card.tone === 'danger'
                ? 'border-red-200 dark:border-red-500/30'
                : 'border-ink-200 dark:border-ink-800',
            )}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">{card.label}</span>
            </div>
            <div
              className={cn(
                'mt-2 break-words text-lg font-semibold leading-tight tracking-tight tabular-nums sm:text-2xl',
                card.tone === 'danger'
                  ? 'text-red-600 dark:text-red-400'
                  : card.tone === 'positive'
                    ? 'text-brand-700 dark:text-brand-400'
                    : 'text-ink-900 dark:text-white',
              )}
            >
              {card.value}
            </div>
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-ink-500 dark:text-ink-400">{card.hint}</p>
          </div>
        );
      })}
    </section>
  );
}
