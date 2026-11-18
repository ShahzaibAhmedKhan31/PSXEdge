import { useMemo } from 'react';
import { computeNormalisedBreakdown } from '../services/investmentCalculator';
import type { IndexKey } from '../types';
import type { InvestmentBreakdown, RankedConstituent } from '../types/investment';

interface UseInvestmentCalculatorArgs {
  /** The currently visible (filtered) companies, already ranked. */
  ranked: readonly RankedConstituent[];
  totalInvestment: number;
  index: IndexKey;
}

/**
 * Memoised allocation for the current selection. The multiplier is derived so
 * the visible adjusted weightages total 100%, then the budget is apportioned in
 * whole rupees. Recomputes only when the selection or the budget changes.
 */
export function useInvestmentCalculator({
  ranked,
  totalInvestment,
  index,
}: UseInvestmentCalculatorArgs): InvestmentBreakdown {
  return useMemo(() => {
    const breakdown = computeNormalisedBreakdown(ranked, totalInvestment);
    return {
      rows: breakdown.rows,
      totals: { ...breakdown.totals, index },
    };
  }, [ranked, totalInvestment, index]);
}
