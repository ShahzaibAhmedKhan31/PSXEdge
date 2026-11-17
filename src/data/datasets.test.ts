import { describe, expect, it } from 'vitest';
import { selectTopConstituents } from '../services/investmentCalculator';
import { INDEX_META } from './indexMeta';
import { SAMPLE_KMI30 } from './sampleKMI30';
import { SAMPLE_KSE100 } from './sampleKSE100';

describe('bundled KSE-100 snapshot', () => {
  it('contains 100 unique constituents', () => {
    expect(SAMPLE_KSE100).toHaveLength(100);
    expect(new Set(SAMPLE_KSE100.map((c) => c.ticker)).size).toBe(100);
  });

  it('has valid weightages that roughly sum to 100%', () => {
    const total = SAMPLE_KSE100.reduce((sum, c) => sum + c.weightage, 0);
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThan(101);
    SAMPLE_KSE100.forEach((c) => {
      expect(c.weightage).toBeGreaterThanOrEqual(0);
      expect(c.weightage).toBeLessThanOrEqual(100);
      expect(c.ticker).toMatch(/^[A-Z0-9-]+$/);
      expect(c.companyName.length).toBeGreaterThan(3);
      expect(c.sector.length).toBeGreaterThan(2);
    });
  });

  it('yields the documented top 20 in descending order', () => {
    const top = selectTopConstituents(SAMPLE_KSE100, INDEX_META.KSE100.topN);
    expect(top).toHaveLength(20);
    expect(top.map((c) => c.ticker)).toEqual([
      'FFC',
      'UBL',
      'MEBL',
      'ENGROH',
      'OGDC',
      'HUBC',
      'LUCK',
      'HBL',
      'MARI',
      'MCB',
      'PPL',
      'BAHL',
      'EFERT',
      'SYS',
      'NBP',
      'BAFL',
      'POL',
      'PSO',
      'MTL',
      'FCCL',
    ]);
    expect(top[0].weightage).toBe(9.13);
    const weights = top.map((c) => c.weightage);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });
});

describe('bundled KMI-30 snapshot', () => {
  it('contains 30 unique constituents', () => {
    expect(SAMPLE_KMI30).toHaveLength(30);
    expect(new Set(SAMPLE_KMI30.map((c) => c.ticker)).size).toBe(30);
  });

  it('has weightages summing to roughly 100%', () => {
    const total = SAMPLE_KMI30.reduce((sum, c) => sum + c.weightage, 0);
    expect(total).toBeGreaterThan(99);
    expect(total).toBeLessThan(101);
  });

  it('yields exactly 15 companies for the strategy, sorted descending', () => {
    const top = selectTopConstituents(SAMPLE_KMI30, INDEX_META.KMI30.topN);
    expect(top).toHaveLength(15);
    expect(top[0].ticker).toBe('FFC');
    expect(top[0].weightage).toBe(12.33);
    expect(top[1].ticker).toBe('ENGROH');
    const weights = top.map((c) => c.weightage);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });
});
