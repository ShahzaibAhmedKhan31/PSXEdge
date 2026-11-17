import { describe, expect, it } from 'vitest';
import { INDEX_META } from '../data/indexMeta';
import { SAMPLE_KMI30 } from '../data/sampleKMI30';
import { SAMPLE_KSE100 } from '../data/sampleKSE100';
import type { Constituent } from '../types';
import {
  adjustedWeightage,
  allocationAmount,
  computeBreakdown,
  estimateAllocation,
  roundMoney,
  selectTopConstituents,
} from './investmentCalculator';

function makeCompanies(weights: number[]): Constituent[] {
  return weights.map((weightage, index) => ({
    ticker: `T${index}`,
    companyName: `Company ${index}`,
    sector: 'Test',
    weightage,
  }));
}

describe('defaults', () => {
  it('uses a 1.5 multiplier for KSE-100 with 20 companies', () => {
    expect(INDEX_META.KSE100.defaultMultiplier).toBe(1.5);
    expect(INDEX_META.KSE100.topN).toBe(20);
  });

  it('uses a 1.1 multiplier for KMI-30 with 15 companies', () => {
    expect(INDEX_META.KMI30.defaultMultiplier).toBe(1.1);
    expect(INDEX_META.KMI30.topN).toBe(15);
  });
});

describe('selectTopConstituents', () => {
  it('sorts by original weightage descending', () => {
    const selected = selectTopConstituents(makeCompanies([1, 9, 4, 12]), 4);
    expect(selected.map((c) => c.weightage)).toEqual([12, 9, 4, 1]);
  });

  it('keeps exactly 20 KSE-100 companies from the 100-name dataset', () => {
    expect(selectTopConstituents(SAMPLE_KSE100, 20)).toHaveLength(20);
  });

  it('keeps exactly 15 KMI-30 companies from the 30-name dataset', () => {
    expect(selectTopConstituents(SAMPLE_KMI30, 15)).toHaveLength(15);
  });

  it('does not mutate the source array', () => {
    const source = makeCompanies([1, 2, 3]);
    selectTopConstituents(source, 2);
    expect(source.map((c) => c.weightage)).toEqual([1, 2, 3]);
  });

  it('is stable for equal weights (ticker tiebreaker)', () => {
    const companies: Constituent[] = [
      { ticker: 'ZZZ', companyName: 'Z', sector: 'S', weightage: 5 },
      { ticker: 'AAA', companyName: 'A', sector: 'S', weightage: 5 },
    ];
    expect(selectTopConstituents(companies, 2).map((c) => c.ticker)).toEqual(['AAA', 'ZZZ']);
  });
});

describe('allocation maths', () => {
  it('matches the documented FFC example (12% × 1.1 = 13.2% → Rs 13,200)', () => {
    const result = estimateAllocation(100_000, 12, 1.1);
    expect(result.adjustedWeightage).toBeCloseTo(13.2, 10);
    expect(result.allocation).toBeCloseTo(13_200, 10);
  });

  it('computes adjusted weightage as weight × multiplier', () => {
    expect(adjustedWeightage(12, 1.5)).toBeCloseTo(18, 10);
    expect(adjustedWeightage(9.13, 1.5)).toBeCloseTo(13.695, 10);
  });

  it('computes allocation as total × adjusted / 100', () => {
    expect(allocationAmount(100_000, 18)).toBeCloseTo(18_000, 10);
    expect(allocationAmount(250_000, 13.2)).toBeCloseTo(33_000, 10);
  });

  it('does not normalise adjusted weightages to 100%', () => {
    const { totals } = computeBreakdown(makeCompanies([50, 30, 20]), 100_000, 1.5, 3);
    expect(totals.adjustedWeightage).toBeCloseTo(150, 10);
    expect(totals.allocatedAmount).toBe(150_000);
  });
});

describe('computeBreakdown totals', () => {
  const companies = makeCompanies([50, 30, 20]);

  it('allocates the full budget when adjusted weights total 100%', () => {
    const { rows, totals } = computeBreakdown(companies, 100_000, 1, 3);
    expect(rows.map((row) => row.allocation)).toEqual([50_000, 30_000, 20_000]);
    expect(totals.allocatedAmount).toBe(100_000);
    expect(totals.remainingCash).toBe(0);
    expect(totals.isOverAllocated).toBe(false);
    expect(totals.overAllocatedBy).toBe(0);
  });

  it('reports remaining cash when under-allocated', () => {
    const { totals } = computeBreakdown(companies, 100_000, 0.5, 3);
    expect(totals.adjustedWeightage).toBeCloseTo(50, 10);
    expect(totals.allocatedAmount).toBe(50_000);
    expect(totals.remainingCash).toBe(50_000);
    expect(totals.isOverAllocated).toBe(false);
  });

  it('warns about over-allocation without changing the budget or multiplier', () => {
    const { totals } = computeBreakdown(companies, 100_000, 1.5, 3);
    expect(totals.isOverAllocated).toBe(true);
    expect(totals.overAllocatedBy).toBeCloseTo(50_000, 6);
    expect(totals.totalInvestment).toBe(100_000);
    expect(totals.multiplier).toBe(1.5);
    expect(totals.remainingCash).toBe(-50_000);
  });

  it('ranks rows from 1 in descending weight order', () => {
    const { rows } = computeBreakdown(companies, 100_000, 1, 3);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
    expect(rows[0].ticker).toBe('T0');
    expect(rows[0].originalWeightage).toBe(50);
  });

  it('limits rows to the index top-N', () => {
    const many = makeCompanies(Array.from({ length: 40 }, (_, index) => index + 1));
    const { rows, totals } = computeBreakdown(many, 100_000, 1, 20);
    expect(rows).toHaveLength(20);
    expect(totals.companyCount).toBe(20);
    expect(rows[0].originalWeightage).toBe(40);
  });

  it('treats non-positive or invalid inputs as zero instead of NaN', () => {
    const negative = computeBreakdown(companies, -5_000, 1, 3);
    expect(negative.totals.allocatedAmount).toBe(0);
    expect(negative.totals.totalInvestment).toBe(0);

    const zeroMultiplier = computeBreakdown(companies, 100_000, 0, 3);
    expect(zeroMultiplier.totals.allocatedAmount).toBe(0);
    expect(zeroMultiplier.totals.adjustedWeightage).toBe(0);

    const nan = computeBreakdown(companies, Number.NaN, Number.NaN, 3);
    expect(nan.totals.allocatedAmount).toBe(0);
    expect(Number.isNaN(nan.totals.remainingCash)).toBe(false);
  });

  it('rounds only for display and keeps totals consistent with the table', () => {
    const odd = makeCompanies([33.33, 33.33, 33.34]);
    const { rows, totals } = computeBreakdown(odd, 100_000, 1, 3);
    const sumOfRounded = rows.reduce((sum, row) => sum + row.allocationRounded, 0);
    expect(totals.allocatedAmount).toBe(sumOfRounded);
    rows.forEach((row) => {
      expect(Number.isInteger(row.allocationRounded)).toBe(true);
      expect(Math.abs(row.allocationRounded - row.allocation)).toBeLessThanOrEqual(0.5);
    });
  });

  it('rounds half rupees with roundMoney', () => {
    expect(roundMoney(2.5)).toBe(3);
    expect(roundMoney(2.4)).toBe(2);
    expect(roundMoney(Number.NaN)).toBe(0);
  });

  it('produces 20 rows for KSE-100 and 15 for KMI-30 with live sample data', () => {
    const kse = computeBreakdown(SAMPLE_KSE100, 1_000_000, 1.5, 20);
    expect(kse.rows).toHaveLength(20);
    expect(kse.rows[0].ticker).toBe('FFC');
    expect(kse.rows[0].originalWeightage).toBe(9.13);
    expect(kse.rows[0].adjustedWeightage).toBeCloseTo(13.695, 6);
    expect(kse.rows[0].allocationRounded).toBe(136_950);
    expect(kse.totals.isOverAllocated).toBe(true);

    const kmi = computeBreakdown(SAMPLE_KMI30, 1_000_000, 1.1, 15);
    expect(kmi.rows).toHaveLength(15);
    expect(kmi.rows[0].ticker).toBe('FFC');
    expect(kmi.rows[0].allocationRounded).toBe(135_630);
    expect(kmi.totals.isOverAllocated).toBe(false);
    expect(kmi.totals.remainingCash).toBeGreaterThan(0);
  });
});
