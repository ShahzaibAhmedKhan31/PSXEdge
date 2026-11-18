import { describe, expect, it } from 'vitest';
import { filterConstituents, rankConstituents } from '../services/investmentCalculator';
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

  it('ranks all 100 companies in descending weight order', () => {
    const ranked = rankConstituents(SAMPLE_KSE100);
    expect(ranked).toHaveLength(100);
    expect(ranked[0]).toMatchObject({ rank: 1, ticker: 'FFC', weightage: 9.13 });
    expect(ranked[99].rank).toBe(100);
    const weights = ranked.map((c) => c.weightage);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it('yields the documented top 20 as a shortlist', () => {
    const top = filterConstituents(rankConstituents(SAMPLE_KSE100), { topN: 20, sector: 'all', search: '' });
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

  it('ranks all 30 companies for the shariah index', () => {
    const ranked = rankConstituents(SAMPLE_KMI30);
    expect(ranked).toHaveLength(30);
    expect(ranked[0]).toMatchObject({ rank: 1, ticker: 'FFC', weightage: 12.33 });
    expect(ranked[1].ticker).toBe('ENGROH');
    const weights = ranked.map((c) => c.weightage);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it('keeps a top-15 shortlist available', () => {
    const top = filterConstituents(rankConstituents(SAMPLE_KMI30), { topN: 15, sector: 'all', search: '' });
    expect(top).toHaveLength(15);
    expect(top[0].ticker).toBe('FFC');
  });
});
