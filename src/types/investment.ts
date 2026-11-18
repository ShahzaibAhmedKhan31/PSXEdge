import type { Constituent, IndexKey } from './index';

/** One row of the allocation table. */
export interface AllocationRow {
  rank: number;
  ticker: string;
  companyName: string;
  sector: string;
  /** Original PSX index weightage in percent. */
  originalWeightage: number;
  /** Auto multiplier applied to this row (same for every row, kept for export). */
  multiplier: number;
  /** originalWeightage × multiplier. The visible rows always total 100%. */
  adjustedWeightage: number;
  /** Precise allocation in PKR (not rounded). */
  allocation: number;
  /** Allocation in whole rupees — what the UI and Excel display. */
  allocationRounded: number;
}

export interface InvestmentTotals {
  /** Budget entered by the user. */
  totalInvestment: number;
  /** Auto multiplier: 100 ÷ sum of the visible original weightages. */
  multiplier: number;
  /** Sum of adjusted weightages; 100 when at least one company is selected. */
  adjustedWeightage: number;
  /** Sum of the rounded per-company allocations (matches the table). */
  allocatedAmount: number;
  /** Sum of precise allocations. */
  allocatedPrecise: number;
  /** totalInvestment − allocatedAmount (normally 0, or < Rs 1 of rounding). */
  remainingCash: number;
  /** Kept for compatibility; normalised allocations never exceed the budget. */
  isOverAllocated: boolean;
  overAllocatedBy: number;
  companyCount: number;
  index: IndexKey | null;
}

export interface InvestmentBreakdown {
  rows: AllocationRow[];
  totals: InvestmentTotals;
}

/** A constituent with its index rank (1 = heaviest). */
export interface RankedConstituent extends Constituent {
  rank: number;
}

/** "all" shows the whole index; a number limits the list to the top N by weight. */
export type TopNSelection = number | 'all';

export interface AllocationFilter {
  topN: TopNSelection;
  /** Free-text drill-down on ticker, company name or sector. */
  search: string;
  /** "all" or an exact PSX sector name. */
  sector: string;
  /**
   * Tickers the user unchecked in the company checklist (Excel-style filter).
   * They are removed from the table and the multiplier renormalises the rest.
   */
  excluded?: readonly string[];
}
