import { useMemo } from 'react';
import type { Constituent, IndexKey } from '../types';
import type { InvestmentBreakdown } from '../types/investment';
import { computeBreakdown } from '../services/investmentCalculator';

interface UseInvestmentCalculatorArgs {
  constituents: readonly Constituent[];
  totalInvestment: number;
  multiplier: number;
  topN: number;
  index: IndexKey;
}

/**
 * Memoised allocation breakdown. Recomputes only when an input actually
 * changes, so typing in the amount field stays instant.
 */
export function useInvestmentCalculator({
  constituents,
  totalInvestment,
  multiplier,
  topN,
  index,
}: UseInvestmentCalculatorArgs): InvestmentBreakdown {
  return useMemo(() => {
    const breakdown = computeBreakdown(constituents, totalInvestment, multiplier, topN);
    return {
      rows: breakdown.rows,
      totals: { ...breakdown.totals, index },
    };
  }, [constituents, totalInvestment, multiplier, topN, index]);
}
