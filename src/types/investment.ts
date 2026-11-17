import type { IndexKey } from './index';

/** One row of the allocation table. */
export interface AllocationRow {
  rank: number;
  ticker: string;
  companyName: string;
  sector: string;
  /** Original PSX index weightage in percent. */
  originalWeightage: number;
  /** Multiplier applied to this row (same for every row, kept for export). */
  multiplier: number;
  /** originalWeightage × multiplier. */
  adjustedWeightage: number;
  /** Precise allocation in PKR (not rounded). */
  allocation: number;
  /** Allocation rounded to whole rupees — what the UI and Excel display. */
  allocationRounded: number;
}

export interface InvestmentTotals {
  /** Budget entered by the user. */
  totalInvestment: number;
  multiplier: number;
  /** Sum of adjusted weightages in percent. Never normalised to 100. */
  adjustedWeightage: number;
  /** Sum of the rounded per-company allocations (matches the table). */
  allocatedAmount: number;
  /** Sum of precise allocations (used for the over-allocation check). */
  allocatedPrecise: number;
  /** totalInvestment − allocatedAmount. Negative when over-allocated. */
  remainingCash: number;
  /** True when adjusted weightages commit more than 100% of the budget. */
  isOverAllocated: boolean;
  /** Amount committed above the budget (0 when within budget). */
  overAllocatedBy: number;
  companyCount: number;
  index: IndexKey | null;
}

export interface InvestmentBreakdown {
  rows: AllocationRow[];
  totals: InvestmentTotals;
}

export interface CalculatorInput {
  totalInvestment: number;
  multiplier: number;
}
