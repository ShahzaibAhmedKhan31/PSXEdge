import { useMemo } from 'react';
import { Table2 } from 'lucide-react';
import { formatPKR } from '../../utils/currencyFormatter';
import { formatPercent } from '../../utils/percentageFormatter';
import type { IndexMeta } from '../../types';
import type { AllocationRow, InvestmentTotals } from '../../types/investment';

interface InvestmentTableProps {
  rows: AllocationRow[];
  totals: InvestmentTotals;
  meta: IndexMeta;
}

export function InvestmentTable({ rows, totals, meta }: InvestmentTableProps) {
  const { maxAllocation, totalOriginalWeightage } = useMemo(() => {
    return {
      maxAllocation: rows.reduce((max, row) => Math.max(max, row.allocationRounded), 0),
      totalOriginalWeightage: rows.reduce((sum, row) => sum + row.originalWeightage, 0),
    };
  }, [rows]);

  return (
    <section
      aria-label={`${meta.label} allocation breakdown`}
      className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900"
    >
      <div className="flex flex-col gap-2 border-b border-ink-200 px-4 py-3 dark:border-ink-800 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-2">
          <Table2 className="h-4 w-4 text-ink-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Allocation breakdown</h2>
          <span className="rounded-md border border-ink-200 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-ink-500 dark:border-ink-700 dark:text-ink-400">
            {rows.length} companies
          </span>
        </div>
        <p className="text-[11px] text-ink-500 dark:text-ink-400">
          Sorted by original weightage (desc) · top {meta.topN} of {meta.label}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">
            {meta.label} top {meta.topN} companies with original and adjusted weightages and investment amounts in
            Pakistani Rupees.
          </caption>
          <thead>
            <tr className="bg-ink-50/80 text-[10px] uppercase tracking-wider text-ink-500 dark:bg-ink-950/60 dark:text-ink-400">
              <th scope="col" className="w-12 px-4 py-2.5 text-left font-semibold">
                Rank
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                Ticker
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                Company name
              </th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">
                Sector
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Original weight
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                Adjusted weight
              </th>
              <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                Investment (PKR)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const width = maxAllocation > 0 ? Math.max(2, (row.allocationRounded / maxAllocation) * 100) : 0;
              return (
                <tr
                  key={row.ticker}
                  className="border-t border-ink-100 transition-colors hover:bg-ink-50/70 dark:border-ink-800/70 dark:hover:bg-ink-800/40"
                >
                  <td className="px-4 py-2.5 text-xs font-medium tabular-nums text-ink-400 dark:text-ink-500">
                    {row.rank}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-md bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-tight text-ink-700 dark:bg-ink-800 dark:text-ink-200">
                      {row.ticker}
                    </span>
                  </td>
                  <td className="max-w-[280px] px-3 py-2.5">
                    <span className="block truncate font-medium text-ink-800 dark:text-ink-100" title={row.companyName}>
                      {row.companyName}
                    </span>
                  </td>
                  <td className="max-w-[220px] px-3 py-2.5">
                    <span
                      className="block truncate text-xs text-ink-500 dark:text-ink-400"
                      title={row.sector}
                    >
                      {row.sector}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs tabular-nums text-ink-600 dark:text-ink-300">
                    {formatPercent(row.originalWeightage)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs font-medium tabular-nums text-ink-800 dark:text-ink-100">
                    {formatPercent(row.adjustedWeightage)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-3">
                      <span
                        aria-hidden="true"
                        className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800 md:block"
                      >
                        <span
                          className="block h-full rounded-full bg-brand-500/80 dark:bg-brand-400/70"
                          style={{ width: `${width}%` }}
                        />
                      </span>
                      <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-ink-900 dark:text-white">
                        {formatPKR(row.allocationRounded)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-brand-600/30 bg-brand-50/60 text-xs dark:border-brand-500/30 dark:bg-brand-500/5">
              <td className="px-4 py-3 font-semibold text-brand-800 dark:text-brand-300" colSpan={4}>
                Total · {rows.length} companies
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-brand-800 dark:text-brand-300">
                {formatPercent(totalOriginalWeightage)}
              </td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums text-brand-800 dark:text-brand-300">
                {formatPercent(totals.adjustedWeightage)}
              </td>
              <td className="px-4 py-3 text-right text-sm font-bold tabular-nums text-brand-800 dark:text-brand-300">
                {formatPKR(totals.allocatedAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="border-t border-ink-100 px-4 py-2 text-[11px] text-ink-400 dark:border-ink-800 dark:text-ink-500 sm:hidden">
        Scroll horizontally to see every column.
      </p>
    </section>
  );
}
