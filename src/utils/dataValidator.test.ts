import { describe, expect, it } from 'vitest';
import { INDEX_META } from '../data/indexMeta';
import type { Constituent } from '../types';
import {
  analyzeConstituents,
  analyzeTable,
  detectColumns,
  isValidDataset,
  normalizeTicker,
  parseWeightage,
  resolveLayout,
} from './dataValidator';

const header = ['Ticker', 'Company Name', 'Sector', 'Weightage'];

function tableFrom(rows: [string, string, string, string | number][]): string[][] {
  return [header, ...rows.map(([ticker, name, sector, weight]) => [ticker, name, sector, String(weight)])];
}

const twentyRows: [string, string, string, number][] = Array.from({ length: 20 }, (_, index) => [
  `T${String(index + 1).padStart(2, '0')}`,
  `Company ${index + 1} Limited`,
  index % 2 === 0 ? 'Cement' : 'Fertilizer',
  Number((10 - index * 0.4).toFixed(2)),
]);

describe('parseWeightage', () => {
  it('parses plain, percentage and thousands-separated values', () => {
    expect(parseWeightage('9.13')).toBe(9.13);
    expect(parseWeightage('9.13%')).toBe(9.13);
    expect(parseWeightage(' 1,234 ')).toBe(1234);
    expect(parseWeightage('0.00')).toBe(0);
    expect(parseWeightage(12.5)).toBe(12.5);
  });

  it('returns null for unusable values', () => {
    expect(parseWeightage('')).toBeNull();
    expect(parseWeightage('-')).toBeNull();
    expect(parseWeightage('n/a')).toBeNull();
    expect(parseWeightage(undefined)).toBeNull();
    expect(parseWeightage(Number.NaN)).toBeNull();
  });
});

describe('normalizeTicker', () => {
  it('cleans PSX decorations', () => {
    expect(normalizeTicker(' ffc ')).toBe('FFC');
    expect(normalizeTicker('FFC XD')).toBe('FFC');
    expect(normalizeTicker('PSX: OGDC')).toBe('OGDC');
    expect(normalizeTicker('MUREB (XD)')).toBe('MUREB');
    expect(normalizeTicker('TPLRF1')).toBe('TPLRF1');
  });

  it('returns an empty string for empty input', () => {
    expect(normalizeTicker('')).toBe('');
    expect(normalizeTicker(42)).toBe('');
  });
});

describe('column detection', () => {
  it('maps common headers', () => {
    expect(detectColumns(['Symbol', 'Name', 'Sector', 'Weightage'])).toEqual({
      ticker: 0,
      company: 1,
      sector: 2,
      weight: 3,
    });
  });

  it('prefers "IDX WTG (%)" over "CHANGE (%)" in PSX-style exports', () => {
    const columns = detectColumns([
      'SYMBOL',
      'NAME',
      'LDCP',
      'CURRENT',
      'CHANGE',
      'CHANGE (%)',
      'IDX WTG (%)',
      'VOLUME',
    ]);
    expect(columns).not.toBeNull();
    expect(columns?.ticker).toBe(0);
    expect(columns?.company).toBe(1);
    expect(columns?.weight).toBe(6);
    expect(columns?.sector).toBe(-1);
  });

  it('returns null when there is no header', () => {
    expect(detectColumns(['FFC', 'Fauji Fertilizer', '9.13'])).toBeNull();
  });

  it('falls back to positional columns for headerless files', () => {
    expect(resolveLayout([['FFC', 'Fauji Fertilizer', 'Fertilizer', '9.13']])).toEqual({
      columns: { ticker: 0, company: 1, sector: 2, weight: 3 },
      startIndex: 0,
      hasHeader: false,
    });
    expect(resolveLayout([['FFC', '9.13']]).columns).toEqual({ ticker: 0, company: -1, sector: -1, weight: 1 });
  });
});

describe('analyzeTable', () => {
  it('accepts a valid KSE-100 file and keeps every valid company', () => {
    const result = analyzeTable(tableFrom(twentyRows), INDEX_META.KSE100);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.all).toHaveLength(20);
    expect(result.all).toHaveLength(20);
    expect(result.all[0].ticker).toBe('T01');
    expect(result.all[0].weightage).toBe(10);
    const weights = result.all.map((row) => row.weightage);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it('sorts by weightage regardless of file order', () => {
    const shuffled = [...twentyRows].reverse();
    const result = analyzeTable(tableFrom(shuffled), INDEX_META.KSE100);
    expect(result.all[0].ticker).toBe('T01');
    expect(result.all[19].ticker).toBe('T20');
  });

  it('accepts a KMI-30 import that exceeds the 15-company minimum', () => {
    const result = analyzeTable(tableFrom(twentyRows), INDEX_META.KMI30);
    expect(result.ok).toBe(true);
    expect(result.all).toHaveLength(20);
    expect(result.errors).toEqual([]);
  });

  it('blocks imports with too few companies', () => {
    const result = analyzeTable(tableFrom(twentyRows.slice(0, 8)), INDEX_META.KSE100);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/needs at least 20/);
  });

  it('skips rows with invalid weightages and reports them', () => {
    const rows = tableFrom(twentyRows);
    rows.push(['BAD', 'Broken Company', 'Cement', 'not-a-number']);
    rows.push(['BAD2', 'Broken Company 2', 'Cement', '150']);
    const result = analyzeTable(rows, INDEX_META.KSE100);
    expect(result.ok).toBe(true);
    expect(result.rowsSkipped).toBe(2);
    expect(result.warnings.join(' ')).toMatch(/2 rows were skipped/);
  });

  it('ignores duplicate tickers', () => {
    const rows = tableFrom(twentyRows);
    rows.push(['T01', 'Duplicate Company', 'Cement', '5']);
    const result = analyzeTable(rows, INDEX_META.KSE100);
    expect(result.ok).toBe(true);
    expect(result.duplicates).toEqual(['T01']);
    expect(result.all.filter((row) => row.ticker === 'T01')).toHaveLength(1);
  });

  it('warns when total weightage is implausible', () => {
    const tiny = twentyRows.map(([ticker, name, sector]) => [ticker, name, sector, '0.10'] as [
      string,
      string,
      string,
      string,
    ]);
    const result = analyzeTable(tableFrom(tiny), INDEX_META.KSE100);
    expect(result.ok).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('index weightages normally sum'))).toBe(true);
  });

  it('handles headerless files', () => {
    const rows = twentyRows.map(([ticker, name, sector, weight]) => [ticker, name, sector, String(weight)]);
    const result = analyzeTable(rows, INDEX_META.KSE100);
    expect(result.ok).toBe(true);
    expect(result.all).toHaveLength(20);
  });

  it('handles PSX-style exports with extra columns and XD tickers', () => {
    const rows: string[][] = [
      ['SYMBOL', 'NAME', 'LDCP', 'CURRENT', 'CHANGE', 'CHANGE (%)', 'IDX WTG (%)', 'VOLUME'],
      ...twentyRows.map(([ticker, name, , weight], index) => [
        index === 0 ? `${ticker} XD` : ticker,
        name,
        '100.00',
        '101.00',
        '1.00',
        '1.00%',
        `${weight}%`,
        '1000',
      ]),
    ];
    const result = analyzeTable(rows, INDEX_META.KSE100);
    expect(result.ok).toBe(true);
    expect(result.all).toHaveLength(20);
    expect(result.all[0].ticker).toBe('T01');
    expect(result.all[0].weightage).toBe(10);
  });

  it('rejects empty files and files without a weightage column', () => {
    expect(analyzeTable([], INDEX_META.KSE100).ok).toBe(false);
    expect(analyzeTable([['Ticker', 'Company Name']], INDEX_META.KSE100).errors[0]).toMatch(/weightage column/);
  });
});

describe('analyzeConstituents', () => {
  const constituents: Constituent[] = [
    { ticker: 'ffc', companyName: 'Fauji Fertilizer', sector: 'Fertilizer', weightage: 9.13 },
    { ticker: 'UBL', companyName: '', sector: '', weightage: 7.75 },
    { ticker: 'FFC', companyName: 'Duplicate', sector: 'Fertilizer', weightage: 5 },
  ];

  it('normalises tickers, fills missing fields and de-duplicates', () => {
    const result = analyzeConstituents(constituents, INDEX_META.KMI30);
    expect(result.ok).toBe(false); // only two unique companies
    expect(result.all).toHaveLength(2);
    expect(result.duplicates).toEqual(['FFC']);
    expect(result.all[1].companyName).toBe('UBL');
    expect(result.all[1].sector).toBe('Unclassified');
  });
});

describe('isValidDataset', () => {
  const valid = {
    index: 'KSE100',
    constituents: [
      { ticker: 'FFC', companyName: 'Fauji Fertilizer', sector: 'Fertilizer', weightage: 9.13 },
      { ticker: 'UBL', companyName: 'United Bank', sector: 'Commercial Banks', weightage: 7.75 },
    ],
    origin: 'bundled',
    sourceLabel: 'Test',
    retrievedAt: '2026-11-17T10:30:00+05:00',
  };

  it('accepts a well-formed dataset', () => {
    expect(isValidDataset(valid)).toBe(true);
    expect(isValidDataset(valid, 'KSE100')).toBe(true);
  });

  it('rejects malformed caches', () => {
    expect(isValidDataset(null)).toBe(false);
    expect(isValidDataset({})).toBe(false);
    expect(isValidDataset({ ...valid, index: 'NOPE' })).toBe(false);
    expect(isValidDataset(valid, 'KMI30')).toBe(false);
    expect(isValidDataset({ ...valid, origin: 'hacked' })).toBe(false);
    expect(isValidDataset({ ...valid, retrievedAt: 'not-a-date' })).toBe(false);
    expect(isValidDataset({ ...valid, constituents: [] })).toBe(false);
    expect(
      isValidDataset({
        ...valid,
        constituents: [{ ticker: 'FFC', companyName: 'x', sector: 'y', weightage: 'nine' }],
      }),
    ).toBe(false);
  });
});

describe('summary rows', () => {
  it('ignores TOTAL rows that some exports append', () => {
    const rows = tableFrom([...twentyRows, ['TOTAL', 'Index total', '', 100]]);
    const result = analyzeTable(rows, INDEX_META.KSE100);
    expect(result.ok).toBe(true);
    expect(result.all.some((row) => row.ticker === 'TOTAL')).toBe(false);
    expect(result.all[0].ticker).toBe('T01');
  });
});
