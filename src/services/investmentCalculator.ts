import type { Constituent } from '../types';
import type { AllocationRow, InvestmentBreakdown, InvestmentTotals } from '../types/investment';

/** Tolerance (in PKR) used when deciding whether the plan is over-allocated. */
const OVER_ALLOCATION_EPSILON = 0.005;

/**
 * Sort constituents by original weightage (descending, ticker as a stable
 * tiebreaker) and keep the top N.
 */
export function selectTopConstituents(constituents: readonly Constituent[], topN: number): Constituent[] {
  if (!Array.isArray(constituents) || topN <= 0) return [];
  return [...constituents]
    .filter((c) => Number.isFinite(c.weightage))
    .sort((a, b) => {
      if (b.weightage !== a.weightage) return b.weightage - a.weightage;
      return a.ticker.localeCompare(b.ticker);
    })
    .slice(0, topN);
}

/** Adjusted weightage = original weightage × multiplier. Never normalised. */
export function adjustedWeightage(originalWeightage: number, multiplier: number): number {
  return originalWeightage * multiplier;
}

/** Allocation = total investment × (adjusted weightage / 100). */
export function allocationAmount(totalInvestment: number, adjustedWeightPercent: number): number {
  return (totalInvestment * adjustedWeightPercent) / 100;
}

/** Round to whole rupees for display/export only. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value + Number.EPSILON);
}

/** Round to 4 decimals — enough to avoid float noise in totals. */
function roundWeight(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Build the full allocation breakdown.
 *
 * All maths uses unrounded values; only `allocationRounded` and the summed
 * totals are rounded, so the table, the summary cards and the Excel export
 * always agree with each other.
 */
export function computeBreakdown(
  constituents: readonly Constituent[],
  totalInvestment: number,
  multiplier: number,
  topN: number,
): InvestmentBreakdown {
  const safeInvestment = Number.isFinite(totalInvestment) && totalInvestment > 0 ? totalInvestment : 0;
  const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 0;

  const companies = selectTopConstituents(constituents, topN);

  const rows: AllocationRow[] = companies.map((company, position) => {
    const adjusted = adjustedWeightage(company.weightage, safeMultiplier);
    const allocation = allocationAmount(safeInvestment, adjusted);
    return {
      rank: position + 1,
      ticker: company.ticker,
      companyName: company.companyName,
      sector: company.sector,
      originalWeightage: company.weightage,
      multiplier: safeMultiplier,
      adjustedWeightage: adjusted,
      allocation,
      allocationRounded: roundMoney(allocation),
    };
  });

  const adjustedTotal = roundWeight(rows.reduce((sum, row) => sum + row.adjustedWeightage, 0));
  const allocatedPrecise = rows.reduce((sum, row) => sum + row.allocation, 0);
  const allocatedAmount = rows.reduce((sum, row) => sum + row.allocationRounded, 0);
  const isOverAllocated = allocatedPrecise > safeInvestment + OVER_ALLOCATION_EPSILON;

  const totals: InvestmentTotals = {
    totalInvestment: safeInvestment,
    multiplier: safeMultiplier,
    adjustedWeightage: adjustedTotal,
    allocatedAmount,
    allocatedPrecise,
    remainingCash: safeInvestment - allocatedAmount,
    isOverAllocated,
    overAllocatedBy: isOverAllocated ? allocatedPrecise - safeInvestment : 0,
    companyCount: rows.length,
    index: null,
  };

  return { rows, totals };
}

/** Convenience helper used in tests and for one-off spot checks. */
export function estimateAllocation(
  totalInvestment: number,
  originalWeightPercent: number,
  multiplier: number,
): { adjustedWeightage: number; allocation: number } {
  const adjusted = adjustedWeightage(originalWeightPercent, multiplier);
  return { adjustedWeightage: adjusted, allocation: allocationAmount(totalInvestment, adjusted) };
}
