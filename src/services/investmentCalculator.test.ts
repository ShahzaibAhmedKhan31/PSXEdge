import { describe, expect, it } from 'vitest';
import { INDEX_META } from '../data/indexMeta';
import { SAMPLE_PRICES } from '../data/priceSnapshot';
import { SAMPLE_KMI30 } from '../data/sampleKMI30';
import { SAMPLE_KSE100 } from '../data/sampleKSE100';
import type { Constituent } from '../types';
import {
  adjustedWeightage,
  allocationAmount,
  apportionRupees,
  computeNormalisedBreakdown,
  createDefaultFilter,
  describeFilter,
  filterConstituents,
  normalisingMultiplier,
  rankConstituents,
  roundMoney,
  sectorOptions,
  toggleExcluded,
} from './investmentCalculator';

function makeCompanies(weights: number[]): Constituent[] {
  return weights.map((weightage, index) => ({
    ticker: `T${index}`,
    companyName: `Company ${index}`,
    sector: 'Test',
    weightage,
  }));
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe('index metadata', () => {
  it('requires a full KSE-100 and KMI-30 dataset for validation', () => {
    expect(INDEX_META.KSE100.minConstituents).toBe(20);
    expect(INDEX_META.KMI30.minConstituents).toBe(15);
    expect(INDEX_META.KSE100.description).toContain('100');
  });
});

describe('rankConstituents', () => {
  it('sorts by original weightage descending and stamps ranks', () => {
    const ranked = rankConstituents(makeCompanies([1, 9, 4, 12]));
    expect(ranked.map((company) => company.weightage)).toEqual([12, 9, 4, 1]);
    expect(ranked.map((company) => company.rank)).toEqual([1, 2, 3, 4]);
  });

  it('ranks every bundled constituent (100 KSE-100, 30 KMI-30)', () => {
    expect(rankConstituents(SAMPLE_KSE100)).toHaveLength(100);
    expect(rankConstituents(SAMPLE_KMI30)).toHaveLength(30);
  });

  it('does not mutate the source array', () => {
    const source = makeCompanies([1, 2, 3]);
    rankConstituents(source);
    expect(source.map((company) => company.weightage)).toEqual([1, 2, 3]);
  });

  it('is stable for equal weights (ticker tiebreaker)', () => {
    const companies: Constituent[] = [
      { ticker: 'ZZZ', companyName: 'Z', sector: 'S', weightage: 5 },
      { ticker: 'AAA', companyName: 'A', sector: 'S', weightage: 5 },
    ];
    expect(rankConstituents(companies).map((company) => company.ticker)).toEqual(['AAA', 'ZZZ']);
  });

  it('drops companies without a finite weightage', () => {
    const companies = [...makeCompanies([3, 2]), { ticker: 'BAD', companyName: 'Bad', sector: 'S', weightage: Number.NaN }];
    expect(rankConstituents(companies).map((company) => company.ticker)).toEqual(['T0', 'T1']);
  });
});

describe('filterConstituents', () => {
  const ranked = rankConstituents([
    { ticker: 'FFC', companyName: 'Fauji Fertilizer Company', sector: 'Fertilizer', weightage: 10 },
    { ticker: 'UBL', companyName: 'United Bank Limited', sector: 'Commercial Banks', weightage: 8 },
    { ticker: 'MEBL', companyName: 'Meezan Bank Limited', sector: 'Commercial Banks', weightage: 6 },
    { ticker: 'OGDC', companyName: 'Oil & Gas Development Company', sector: 'Oil & Gas Exploration', weightage: 4 },
    { ticker: 'LUCK', companyName: 'Lucky Cement', sector: 'Cement', weightage: 2 },
  ]);

  it('returns the whole list by default', () => {
    expect(filterConstituents(ranked, createDefaultFilter())).toHaveLength(5);
  });

  it('applies the top-N shortlist before any drill-down filter', () => {
    const visible = filterConstituents(ranked, { topN: 3, sector: 'all', search: '' });
    expect(visible.map((company) => company.ticker)).toEqual(['FFC', 'UBL', 'MEBL']);
  });

  it('filters by sector, case-insensitively', () => {
    const visible = filterConstituents(ranked, { topN: 'all', sector: 'commercial banks', search: '' });
    expect(visible.map((company) => company.ticker)).toEqual(['UBL', 'MEBL']);
  });

  it('searches ticker, company name and sector', () => {
    expect(
      filterConstituents(ranked, { topN: 'all', sector: 'all', search: 'ffc' }).map((c) => c.ticker),
    ).toEqual(['FFC']);
    expect(
      filterConstituents(ranked, { topN: 'all', sector: 'all', search: 'bank' }).map((c) => c.ticker),
    ).toEqual(['UBL', 'MEBL']);
    expect(
      filterConstituents(ranked, { topN: 'all', sector: 'all', search: 'cement' }).map((c) => c.ticker),
    ).toEqual(['LUCK']);
  });

  it('combines the shortlist with the drill-down filters', () => {
    const visible = filterConstituents(ranked, { topN: 2, sector: 'Commercial Banks', search: 'meezan' });
    expect(visible).toHaveLength(0);

    const withinTopFour = filterConstituents(ranked, { topN: 4, sector: 'Commercial Banks', search: 'meezan' });
    expect(withinTopFour.map((company) => company.ticker)).toEqual(['MEBL']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterConstituents(ranked, { topN: 'all', sector: 'all', search: 'zzz' })).toEqual([]);
  });
});

describe('company checklist (exclusions)', () => {
  const ranked = rankConstituents([
    { ticker: 'FFC', companyName: 'Fauji Fertilizer Company', sector: 'Fertilizer', weightage: 60 },
    { ticker: 'UBL', companyName: 'United Bank Limited', sector: 'Commercial Banks', weightage: 20 },
    { ticker: 'LUCK', companyName: 'Lucky Cement', sector: 'Cement', weightage: 20 },
  ]);

  it('removes unchecked tickers from the visible list', () => {
    const visible = filterConstituents(ranked, { topN: 'all', sector: 'all', search: '', excluded: ['UBL'] });
    expect(visible.map((company) => company.ticker)).toEqual(['FFC', 'LUCK']);
  });

  it('renormalises the multiplier over the companies that remain', () => {
    const { rows, totals } = computeNormalisedBreakdown(
      filterConstituents(ranked, { topN: 'all', sector: 'all', search: '', excluded: ['UBL'] }),
      100_000,
    );
    expect(totals.multiplier).toBeCloseTo(100 / 80, 12);
    expect(totals.adjustedWeightage).toBe(100);
    expect(rows.map((row) => row.allocationRounded)).toEqual([75_000, 25_000]);
    expect(totals.allocatedAmount).toBe(100_000);
  });

  it('composes with the shortlist and drill-down filters', () => {
    const visible = filterConstituents(ranked, {
      topN: 2,
      sector: 'all',
      search: '',
      excluded: ['FFC'],
    });
    // UBL and LUCK both weigh 20, so the ticker tiebreaker puts LUCK at rank 2.
    expect(visible.map((company) => company.ticker)).toEqual(['LUCK']);
  });

  it('toggles tickers case-insensitively without mutating the input', () => {
    const excluded: string[] = [];
    const onceAdded = toggleExcluded(excluded, 'ubl');
    expect(onceAdded).toEqual(['UBL']);
    expect(excluded).toEqual([]);
    expect(toggleExcluded(onceAdded, 'UBL')).toEqual([]);
  });

  it('describes the exclusion in the filter summary', () => {
    expect(
      describeFilter({ topN: 'all', sector: 'all', search: '', excluded: ['UBL', 'LUCK'] }, 3),
    ).toBe('All 3 companies · excluding 2 companies (UBL, LUCK)');
    expect(describeFilter({ topN: 'all', sector: 'all', search: '', excluded: ['UBL'] }, 3)).toBe(
      'All 3 companies · excluding 1 company (UBL)',
    );
  });

  it('defaults to nothing excluded', () => {
    expect(createDefaultFilter().excluded).toEqual([]);
  });
});

describe('sectorOptions', () => {
  it('lists distinct sectors alphabetically', () => {
    const ranked = rankConstituents([
      { ticker: 'A', companyName: 'A', sector: 'Oil & Gas', weightage: 3 },
      { ticker: 'B', companyName: 'B', sector: 'Cement', weightage: 2 },
      { ticker: 'C', companyName: 'C', sector: 'Oil & Gas', weightage: 1 },
    ]);
    expect(sectorOptions(ranked)).toEqual(['Cement', 'Oil & Gas']);
  });
});

describe('normalisingMultiplier', () => {
  it('is 100 ÷ the sum of the selected original weightages', () => {
    expect(normalisingMultiplier(makeCompanies([50, 30, 20]))).toBeCloseTo(1, 10);
    expect(normalisingMultiplier(makeCompanies([25, 25]))).toBeCloseTo(2, 10);
    expect(normalisingMultiplier(makeCompanies([10, 5]))).toBeCloseTo(100 / 15, 10);
  });

  it('returns 0 for an empty or all-zero selection', () => {
    expect(normalisingMultiplier([])).toBe(0);
    expect(normalisingMultiplier(makeCompanies([0, 0]))).toBe(0);
  });

  it('ignores invalid weightages', () => {
    const companies = [...makeCompanies([20, 30]), { ticker: 'X', companyName: 'X', sector: 'S', weightage: Number.NaN }];
    expect(normalisingMultiplier(companies)).toBeCloseTo(2, 10);
  });

  it('normalises the top-20 slice of the KSE-100 sample', () => {
    const ranked = rankConstituents(SAMPLE_KSE100);
    const top20 = filterConstituents(ranked, { topN: 20, sector: 'all', search: '' });
    const weightSum = sum(top20.map((company) => company.weightage));
    expect(normalisingMultiplier(top20)).toBeCloseTo(100 / weightSum, 12);
    expect(top20[0].ticker).toBe('FFC');
    expect(top20[0].weightage).toBe(9.13);
  });
});

describe('adjusted and allocation maths', () => {
  it('computes adjusted weightage as weight × multiplier', () => {
    expect(adjustedWeightage(12, 1.5)).toBeCloseTo(18, 10);
    expect(adjustedWeightage(9.13, 1.5)).toBeCloseTo(13.695, 10);
  });

  it('computes allocation as total × adjusted / 100', () => {
    expect(allocationAmount(100_000, 18)).toBeCloseTo(18_000, 10);
    expect(allocationAmount(250_000, 13.2)).toBeCloseTo(33_000, 10);
  });

  it('rounds half rupees with roundMoney', () => {
    expect(roundMoney(2.5)).toBe(3);
    expect(roundMoney(2.4)).toBe(2);
    expect(roundMoney(Number.NaN)).toBe(0);
  });
});

describe('apportionRupees', () => {
  it('splits the budget proportionally in whole rupees', () => {
    expect(apportionRupees(100_000, [50, 30, 20])).toEqual([50_000, 30_000, 20_000]);
  });

  it('always sums to the rounded budget', () => {
    const parts = apportionRupees(1_000, [1, 1, 1]);
    expect(sum(parts)).toBe(1_000);
    expect(parts).toEqual([334, 333, 333]);

    const odd = apportionRupees(12_345.67, [9.13, 7.75, 5.1, 5.06, 4.11]);
    expect(sum(odd)).toBe(12_346);
    odd.forEach((part) => expect(Number.isInteger(part)).toBe(true));
  });

  it('handles empty, zero-budget and zero-weight inputs', () => {
    expect(apportionRupees(10_000, [])).toEqual([]);
    expect(apportionRupees(0, [1, 2])).toEqual([0, 0]);
    expect(apportionRupees(10_000, [0, 0])).toEqual([0, 0]);
    expect(apportionRupees(Number.NaN, [1, 1])).toEqual([0, 0]);
  });
});

describe('computeNormalisedBreakdown', () => {
  const companies = makeCompanies([50, 30, 20]);

  it('derives a multiplier so adjusted weightages total exactly 100%', () => {
    const { totals } = computeNormalisedBreakdown(rankConstituents(companies), 100_000);
    expect(totals.multiplier).toBeCloseTo(1, 10);
    expect(totals.adjustedWeightage).toBe(100);
  });

  it('rebalances after filtering, keeping the total at 100%', () => {
    const { rows, totals } = computeNormalisedBreakdown(rankConstituents(makeCompanies([60, 20, 20])), 100_000);
    expect(totals.adjustedWeightage).toBe(100);
    expect(rows.map((row) => row.adjustedWeightage)).toEqual([60, 20, 20]);

    const topTwo = rankConstituents(makeCompanies([60, 20, 20])).slice(0, 2);
    const rebalanced = computeNormalisedBreakdown(topTwo, 100_000);
    expect(rebalanced.totals.multiplier).toBeCloseTo(100 / 80, 12);
    expect(rebalanced.totals.adjustedWeightage).toBe(100);
    expect(sum(rebalanced.rows.map((row) => row.adjustedWeightage))).toBeCloseTo(100, 10);
  });

  it('allocates the entire budget and leaves no cash behind', () => {
    const { rows, totals } = computeNormalisedBreakdown(rankConstituents(companies), 100_000);
    expect(rows.map((row) => row.allocation)).toEqual([50_000, 30_000, 20_000]);
    expect(totals.allocatedAmount).toBe(100_000);
    expect(totals.remainingCash).toBe(0);
    expect(totals.isOverAllocated).toBe(false);
    expect(totals.overAllocatedBy).toBe(0);
  });

  it('uses the same derived multiplier on every row and in the totals', () => {
    const { rows, totals } = computeNormalisedBreakdown(rankConstituents(companies), 250_000);
    rows.forEach((row) => expect(row.multiplier).toBe(totals.multiplier));
    expect(totals.allocatedAmount).toBe(250_000);
  });

  it('ranks rows from 1 in descending weight order', () => {
    const { rows } = computeNormalisedBreakdown(rankConstituents(companies), 100_000);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
    expect(rows[0].ticker).toBe('T0');
    expect(rows[0].originalWeightage).toBe(50);
  });

  it('handles an empty selection without NaN or division by zero', () => {
    const { rows, totals } = computeNormalisedBreakdown([], 100_000);
    expect(rows).toEqual([]);
    expect(totals.multiplier).toBe(0);
    expect(totals.adjustedWeightage).toBe(0);
    expect(totals.allocatedAmount).toBe(0);
    expect(totals.remainingCash).toBe(100_000);
    expect(Number.isNaN(totals.remainingCash)).toBe(false);
  });

  it('treats a negative or non-finite budget as zero', () => {
    const negative = computeNormalisedBreakdown(rankConstituents(companies), -5_000);
    expect(negative.totals.totalInvestment).toBe(0);
    expect(negative.totals.allocatedAmount).toBe(0);

    const nan = computeNormalisedBreakdown(rankConstituents(companies), Number.NaN);
    expect(nan.totals.allocatedAmount).toBe(0);
    expect(Number.isNaN(nan.totals.remainingCash)).toBe(false);
  });

  it('rounds rupees only for display and keeps totals equal to the table', () => {
    const odd = makeCompanies([33.33, 33.33, 33.34]);
    const { rows, totals } = computeNormalisedBreakdown(rankConstituents(odd), 100_000);
    const sumOfRounded = rows.reduce((total, row) => total + row.allocationRounded, 0);
    expect(totals.allocatedAmount).toBe(sumOfRounded);
    expect(sumOfRounded).toBe(100_000);
    rows.forEach((row) => {
      expect(Number.isInteger(row.allocationRounded)).toBe(true);
      expect(Math.abs(row.allocationRounded - row.allocation)).toBeLessThanOrEqual(0.5);
    });
  });

  it('builds the full KSE-100 and KMI-30 lists with the multiplier near 1', () => {
    const kseRanked = rankConstituents(SAMPLE_KSE100);
    const kse = computeNormalisedBreakdown(kseRanked, 1_000_000);
    expect(kse.rows).toHaveLength(100);
    expect(kse.rows[0].ticker).toBe('FFC');
    expect(kse.rows[0].originalWeightage).toBe(9.13);
    expect(kse.totals.multiplier).toBeCloseTo(100 / sum(SAMPLE_KSE100.map((c) => c.weightage)), 12);
    expect(kse.totals.adjustedWeightage).toBe(100);
    expect(kse.totals.allocatedAmount).toBe(1_000_000);

    const kmiRanked = rankConstituents(SAMPLE_KMI30);
    const kmi = computeNormalisedBreakdown(kmiRanked, 1_000_000);
    expect(kmi.rows).toHaveLength(30);
    expect(kmi.rows[0].ticker).toBe('FFC');
    expect(kmi.totals.adjustedWeightage).toBe(100);
    expect(kmi.totals.allocatedAmount).toBe(1_000_000);
    expect(kmi.totals.remainingCash).toBe(0);
  });

  it('keeps rupee totals whole for awkward budgets', () => {
    const { rows, totals } = computeNormalisedBreakdown(rankConstituents(makeCompanies([3, 5, 7, 11])), 99_999.99);
    expect(totals.allocatedAmount).toBe(100_000);
    expect(sum(rows.map((row) => row.allocationRounded))).toBe(100_000);
  });
});

describe('whole shares and prices', () => {
  const ffc = rankConstituents([
    { ticker: 'FFC', companyName: 'Fauji Fertilizer Company Limited', sector: 'Fertilizer', weightage: 100 },
  ]);

  it("floors the user's example: Rs 4,831 ÷ Rs 571.30 → 8 shares", () => {
    const { rows, totals } = computeNormalisedBreakdown(ffc, 4_831, { FFC: 571.3 });
    expect(rows[0].allocationRounded).toBe(4_831);
    expect(rows[0].price).toBe(571.3);
    expect(rows[0].shares).toBe(8);
    expect(rows[0].cost).toBeCloseTo(4_570.4, 2);
    expect(totals.totalShares).toBe(8);
    expect(totals.investedAmount).toBeCloseTo(4_570.4, 2);
    expect(totals.uninvestedCash).toBeCloseTo(260.6, 2);
  });

  it('floors rather than rounds up, so a row never costs more than its allocation', () => {
    const { rows } = computeNormalisedBreakdown(ffc, 1_000, { FFC: 600 });
    expect(rows[0].shares).toBe(1);
    expect(rows[0].cost).toBe(600);
  });

  it('never spends more than the budget across a whole index', () => {
    const ranked = rankConstituents(SAMPLE_KSE100);
    const { rows, totals } = computeNormalisedBreakdown(ranked, 100_000, SAMPLE_PRICES.KSE100);
    const spend = rows.reduce((sum, row) => sum + (row.price ?? 0) * row.shares, 0);

    expect(totals.investedAmount).toBeCloseTo(spend, 2);
    expect(totals.investedAmount).toBeLessThanOrEqual(100_000);
    expect(totals.uninvestedCash).toBeCloseTo(100_000 - totals.investedAmount, 2);
    expect(totals.totalShares).toBe(rows.reduce((sum, row) => sum + row.shares, 0));
    expect(totals.investedAmount).toBeGreaterThan(0);
  });

  it('recomputes shares when filtering changes the allocations', () => {
    const ranked = rankConstituents(SAMPLE_KMI30);
    const prices = SAMPLE_PRICES.KMI30;
    const top5 = rankConstituents(filterConstituents(ranked, { topN: 5, sector: 'all', search: '' }));
    const all = computeNormalisedBreakdown(ranked, 500_000, prices);
    const subset = computeNormalisedBreakdown(top5, 500_000, prices);

    // The subset gets bigger per-row allocations (multiplier rebalances), so FFC needs more shares.
    expect(subset.rows[0].allocationRounded).toBeGreaterThan(all.rows[0].allocationRounded);
    expect(subset.rows[0].shares).toBeGreaterThan(all.rows[0].shares);
    expect(subset.totals.investedAmount).toBeLessThanOrEqual(500_000);
  });

  it('reports missing, zero and invalid prices without inventing shares', () => {
    const ranked = rankConstituents([
      { ticker: 'AAA', companyName: 'A', sector: 'S', weightage: 50 },
      { ticker: 'BBB', companyName: 'B', sector: 'S', weightage: 30 },
      { ticker: 'CCC', companyName: 'C', sector: 'S', weightage: 20 },
    ]);
    const { rows, totals } = computeNormalisedBreakdown(ranked, 10_000, {
      AAA: 100,
      BBB: 0,
      CCC: Number.NaN,
    });

    expect(rows.map((row) => row.price)).toEqual([100, null, null]);
    expect(rows.map((row) => row.shares)).toEqual([50, 0, 0]);
    expect(totals.missingPriceCount).toBe(2);
    expect(totals.totalShares).toBe(50);
    expect(totals.investedAmount).toBe(5_000);
    expect(totals.uninvestedCash).toBe(5_000);
  });

  it('behaves exactly like before when no prices are supplied', () => {
    const { rows, totals } = computeNormalisedBreakdown(rankConstituents(makeCompanies([60, 40])), 100_000);
    expect(rows.every((row) => row.price === null && row.shares === 0 && row.cost === 0)).toBe(true);
    expect(totals.investedAmount).toBe(0);
    expect(totals.uninvestedCash).toBe(100_000);
    expect(totals.missingPriceCount).toBe(2);
    expect(totals.remainingCash).toBe(0);
  });
});

describe('describeFilter', () => {
  it('describes the whole index', () => {
    expect(describeFilter(createDefaultFilter(), 100)).toBe('All 100 companies');
  });

  it('describes a shortlist plus drill-down', () => {
    expect(describeFilter({ topN: 20, sector: 'Commercial Banks', search: '' }, 100)).toBe(
      'Top 20 of 100 by weightage · sector: Commercial Banks',
    );
    expect(describeFilter({ topN: 10, sector: 'all', search: 'bank' }, 30)).toBe(
      'Top 10 of 30 by weightage · search: “bank”',
    );
  });

  it('clamps a preset larger than the dataset', () => {
    expect(describeFilter({ topN: 50, sector: 'all', search: '' }, 30)).toBe('Top 30 of 30 by weightage');
  });
});
