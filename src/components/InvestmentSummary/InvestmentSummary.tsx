import { Banknote, Coins, Hash, PieChart, Scale, Wallet } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatPKR } from '../../utils/currencyFormatter';
import { formatMultiplierAuto, formatPercent } from '../../utils/percentageFormatter';
import type { InvestmentTotals } from '../../types/investment';

interface InvestmentSummaryProps {
  totals: InvestmentTotals;
}

export function InvestmentSummary({ totals }: InvestmentSummaryProps) {
  const priced = totals.companyCount - totals.missingPriceCount;
  const fullyInvested = totals.companyCount > 0 && totals.uninvestedCash < 1;

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
      hint:
        totals.companyCount > 0
          ? `${totals.companyCount} ${totals.companyCount === 1 ? 'company' : 'companies'} · target amounts`
          : 'Nothing allocated',
      icon: PieChart,
      tone: 'default' as const,
    },
    {
      label: 'Shares to buy',
      value: totals.totalShares.toLocaleString('en-PK'),
      hint:
        totals.missingPriceCount > 0
          ? `${totals.missingPriceCount} ${totals.missingPriceCount === 1 ? 'company has' : 'companies have'} no price`
          : `${priced} ${priced === 1 ? 'company' : 'companies'} · whole shares only`,
      icon: Hash,
      tone: 'default' as const,
    },
    {
      label: 'Invested amount',
      value: formatPKR(totals.investedAmount),
      hint:
        totals.companyCount > 0
          ? 'Σ shares × current price'
          : 'Add prices to size the plan',
      icon: Banknote,
      tone: 'default' as const,
    },
    {
      label: 'Uninvested cash',
      value: formatPKR(totals.uninvestedCash),
      hint: fullyInvested ? 'Everything invested' : 'Left over — no whole share fits',
      icon: Coins,
      tone: fullyInvested ? ('positive' as const) : ('default' as const),
    },
  ];

  return (
    <section aria-label="Investment summary" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-xl border border-ink-200 bg-white p-4 shadow-card dark:border-ink-800 dark:bg-ink-900"
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">{card.label}</span>
            </div>
            <div
              className={cn(
                'mt-2 break-words text-lg font-semibold leading-tight tracking-tight tabular-nums sm:text-2xl',
                card.tone === 'positive'
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
