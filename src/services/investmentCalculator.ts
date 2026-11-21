import type { Constituent } from '../types';
import type {
  AllocationFilter,
  AllocationRow,
  InvestmentBreakdown,
  InvestmentTotals,
  RankedConstituent,
} from '../types/investment';

/** Adjusted weightage = original weightage × multiplier. */
export function adjustedWeightage(originalWeightage: number, multiplier: number): number {
  return originalWeightage * multiplier;
}

/** Allocation = total investment × (adjusted weightage / 100). */
export function allocationAmount(totalInvestment: number, adjustedWeightPercent: number): number {
  return (totalInvestment * adjustedWeightPercent) / 100;
}

/** A usable price is finite and positive; anything else means "no price". */
export function normalisePrice(value: unknown): number | null {
  const price = typeof value === 'string' ? Number(value.replace(/,/g, '')) : Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

/** Whole shares affordable with an amount: ⌊amount ÷ price⌋, 0 without a price. */
export function wholeShares(amount: number, price: number | null): number {
  if (price === null || !Number.isFinite(price) || price <= 0) return 0;
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.floor(amount / price);
}

/** Round to whole rupees. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value + Number.EPSILON);
}

/** Sort by original weightage (desc, ticker tiebreaker) and stamp ranks. */
export function rankConstituents(constituents: readonly Constituent[]): RankedConstituent[] {
  if (!Array.isArray(constituents)) return [];
  return [...constituents]
    .filter((company) => Number.isFinite(company.weightage))
    .sort((a, b) => {
      if (b.weightage !== a.weightage) return b.weightage - a.weightage;
      return a.ticker.localeCompare(b.ticker);
    })
    .map((company, position) => ({ ...company, rank: position + 1 }));
}

/**
 * Apply the user's selection to a ranked list.
 *
 * The top-N limit is applied first (it is defined by index rank), then the
 * drill-down filters narrow what is visible. The multiplier later normalises
 * whatever survives this filter, so drilling down re-weights the portfolio.
 */
export function filterConstituents(
  ranked: readonly RankedConstituent[],
  filter: AllocationFilter,
): RankedConstituent[] {
  const limit =
    filter.topN === 'all' ? ranked.length : Math.max(1, Math.floor(Number(filter.topN) || ranked.length));
  const term = filter.search.trim().toLowerCase();
  const sector = filter.sector.trim().toLowerCase();
  const excluded = new Set((filter.excluded ?? []).map((ticker) => ticker.trim().toUpperCase()));

  return ranked.slice(0, limit).filter((company) => {
    if (excluded.has(company.ticker.toUpperCase())) return false;
    if (sector && sector !== 'all' && company.sector.toLowerCase() !== sector) return false;
    if (!term) return true;
    return (
      company.ticker.toLowerCase().includes(term) ||
      company.companyName.toLowerCase().includes(term) ||
      company.sector.toLowerCase().includes(term)
    );
  });
}

/** Distinct sectors present in a dataset, alphabetically sorted. */
export function sectorOptions(ranked: readonly RankedConstituent[]): string[] {
  return [...new Set(ranked.map((company) => company.sector))].sort((a, b) => a.localeCompare(b));
}

/**
 * The multiplier that makes the visible adjusted weightages total 100%.
 * `100 ÷ Σ original weights`. Read-only by design — it is derived, not tuned.
 */
export function normalisingMultiplier(companies: readonly Constituent[]): number {
  const total = companies.reduce(
    (sum, company) => sum + (Number.isFinite(company.weightage) && company.weightage > 0 ? company.weightage : 0),
    0,
  );
  if (total <= 0) return 0;
  return 100 / total;
}

/**
 * Split `total` into whole rupees proportionally to `weights` using the largest
 * remainder method, so the rounded parts add up to exactly `Math.round(total)`.
 * That keeps the table, the summary and the Excel totals row identical.
 */
export function apportionRupees(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 0;
  const weightSum = weights.reduce((sum, weight) => sum + (Number.isFinite(weight) && weight > 0 ? weight : 0), 0);
  if (safeTotal <= 0 || weightSum <= 0) return weights.map(() => 0);

  const target = Math.round(safeTotal);
  const precise = weights.map((weight) => (safeTotal * Math.max(weight, 0)) / weightSum);
  const rounded = precise.map(Math.floor);
  let remainder = target - rounded.reduce((sum, value) => sum + value, 0);

  const byRemainder = precise
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  if (remainder > 0) {
    for (let step = 0; step < remainder; step += 1) {
      rounded[byRemainder[step % byRemainder.length].index] += 1;
    }
  } else if (remainder < 0) {
    // Defensive: give back rupees from the smallest remainders.
    for (let step = 0; step < -remainder; step += 1) {
      const candidate = byRemainder[byRemainder.length - 1 - (step % byRemainder.length)].index;
      if (rounded[candidate] > 0) rounded[candidate] -= 1;
    }
  }

  return rounded;
}

/**
 * Build the allocation for the current selection.
 *
 * The multiplier is derived from the visible rows so their adjusted weightages
 * total 100%; the budget is then apportioned in whole rupees that sum to the
 * budget. When prices are supplied, each row is converted to whole shares with
 * a floor, so Σ(shares × price) can never exceed the budget — the remainder is
 * reported as uninvested cash. With an empty selection everything is zero.
 */
export function computeNormalisedBreakdown(
  ranked: readonly RankedConstituent[],
  totalInvestment: number,
  prices: Readonly<Record<string, number>> = {},
): InvestmentBreakdown {
  const safeInvestment = Number.isFinite(totalInvestment) && totalInvestment > 0 ? totalInvestment : 0;
  const multiplier = normalisingMultiplier(ranked);
  const adjustedWeights = ranked.map((company) => company.weightage * multiplier);
  const roundedAllocations = apportionRupees(safeInvestment, adjustedWeights);

  const rows: AllocationRow[] = ranked.map((company, position) => {
    const adjusted = adjustedWeights[position];
    const allocation = allocationAmount(safeInvestment, adjusted);
    const allocationRounded = roundedAllocations[position] ?? 0;
    const price = normalisePrice(prices[company.ticker]);
    const shares = wholeShares(allocationRounded, price);
    return {
      rank: company.rank,
      ticker: company.ticker,
      companyName: company.companyName,
      sector: company.sector,
      originalWeightage: company.weightage,
      multiplier,
      adjustedWeightage: adjusted,
      allocation,
      allocationRounded,
      price,
      shares,
      cost: price === null ? 0 : Math.round(shares * price * 100) / 100,
    };
  });

  const allocatedPrecise = rows.reduce((sum, row) => sum + row.allocation, 0);
  const allocatedAmount = rows.reduce((sum, row) => sum + row.allocationRounded, 0);

  const totalShares = rows.reduce((sum, row) => sum + row.shares, 0);
  const investedAmount = Math.round(rows.reduce((sum, row) => sum + row.cost, 0) * 100) / 100;

  const totals: InvestmentTotals = {
    totalInvestment: safeInvestment,
    multiplier,
    // The derived multiplier makes the visible adjusted weights sum to 100 by
    // construction; an empty (or all-zero) selection totals zero.
    adjustedWeightage: multiplier > 0 ? 100 : 0,
    allocatedAmount,
    allocatedPrecise,
    remainingCash: safeInvestment - allocatedAmount,
    totalShares,
    investedAmount,
    uninvestedCash: Math.max(0, Math.round((safeInvestment - investedAmount) * 100) / 100),
    missingPriceCount: rows.filter((row) => row.price === null).length,
    isOverAllocated: false,
    overAllocatedBy: 0,
    companyCount: rows.length,
    index: null,
  };

  return { rows, totals };
}

/** Default filter: the whole index, no drill-down, nothing unchecked. */
export function createDefaultFilter(): AllocationFilter {
  return { topN: 'all', search: '', sector: 'all', excluded: [] };
}

/** Toggle one ticker in the exclusion list used by the company checklist. */
export function toggleExcluded(excluded: readonly string[], ticker: string): string[] {
  const upper = ticker.toUpperCase();
  const has = excluded.some((value) => value.toUpperCase() === upper);
  return has ? excluded.filter((value) => value.toUpperCase() !== upper) : [...excluded, upper];
}

/** Human readable description of the active selection (used in UI + Excel). */
export function describeFilter(filter: AllocationFilter, totalCount: number): string {
  const parts: string[] = [];
  if (filter.topN === 'all') {
    parts.push(`All ${totalCount} companies`);
  } else {
    parts.push(`Top ${Math.min(Number(filter.topN), totalCount)} of ${totalCount} by weightage`);
  }
  if (filter.sector && filter.sector !== 'all') parts.push(`sector: ${filter.sector}`);
  if (filter.search.trim()) parts.push(`search: “${filter.search.trim()}”`);
  const excluded = filter.excluded ?? [];
  if (excluded.length > 0) {
    const preview = excluded.slice(0, 3).join(', ');
    const more = excluded.length > 3 ? `, +${excluded.length - 3} more` : '';
    parts.push(
      `excluding ${excluded.length} ${excluded.length === 1 ? 'company' : 'companies'} (${preview}${more})`,
    );
  }
  return parts.join(' · ');
}
