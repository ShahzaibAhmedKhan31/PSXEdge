import { describe, expect, it } from 'vitest';
import { SAMPLE_PRICES } from '../data/priceSnapshot';
import { SAMPLE_KSE100 } from '../data/sampleKSE100';
import {
  formatPriceList,
  loadPriceSet,
  parsePriceList,
  snapshotPriceSet,
  withPrice,
  withPrices,
  withoutPrices,
} from './priceService';

const tickers = SAMPLE_KSE100.map((company) => company.ticker);
const now = new Date('2026-11-21T09:30:00+05:00');

describe('parsePriceList', () => {
  it('reads comma, space, colon and tab separated lines', () => {
    const parsed = parsePriceList('FFC, 571.30\nUBL 431.44\nMEBL: 547.54\nOGDC\t312.55', tickers);
    expect(parsed.prices).toEqual({ FFC: 571.3, UBL: 431.44, MEBL: 547.54, OGDC: 312.55 });
    expect(parsed.skipped).toBe(0);
    expect(parsed.unknown).toEqual([]);
  });

  it('normalises lowercase tickers, quotes, "Rs" and thousands separators', () => {
    const parsed = parsePriceList('"ffc", "Rs 571.30"\nNESTLE, 7,020.51', tickers);
    expect(parsed.prices).toEqual({ FFC: 571.3, NESTLE: 7020.51 });
    expect(parsed.skipped).toBe(0);
  });

  it('reports unknown tickers and unreadable lines', () => {
    const parsed = parsePriceList('ZZZZ, 10\nnot a price\nFFC, 571', tickers);
    expect(parsed.prices).toEqual({ FFC: 571 });
    expect(parsed.unknown).toEqual(['ZZZZ']);
    expect(parsed.skipped).toBe(1);
  });

  it('drops zero and negative prices', () => {
    const parsed = parsePriceList('FFC, 0\nUBL, -5\nMEBL, 547.54', tickers);
    expect(parsed.prices).toEqual({ MEBL: 547.54 });
    expect(parsed.skipped).toBe(2);
  });

  it('treats “TICKER,” with no price as a deliberate clear', () => {
    const parsed = parsePriceList('FFC,\nUBL\nMEBL, 547.54', tickers);
    expect(parsed.prices).toEqual({ MEBL: 547.54 });
    expect(parsed.removed).toEqual(['FFC']);
    expect(parsed.skipped).toBe(1); // "UBL" with no separator is not a pair
  });

  it('ignores blank lines and header rows', () => {
    const parsed = parsePriceList('\nTICKER, PRICE\n\nFFC, 571.30\n', tickers);
    expect(parsed.prices).toEqual({ FFC: 571.3 });
    expect(parsed.skipped).toBe(1);
  });
});

describe('formatPriceList', () => {
  it('round-trips through parsePriceList', () => {
    const text = formatPriceList(['FFC', 'UBL', 'MEBL'], { FFC: 571.3, UBL: 431.44, MEBL: 547.54 });
    expect(text).toBe('FFC,571.30\nUBL,431.44\nMEBL,547.54');
    expect(parsePriceList(text, tickers).prices).toEqual({ FFC: 571.3, UBL: 431.44, MEBL: 547.54 });
  });

  it('leaves unpriced companies blank so they stay unpriced', () => {
    expect(formatPriceList(['FFC', 'XYZ'], { FFC: 571.3 })).toBe('FFC,571.30\nXYZ,');
  });
});

describe('price set edits', () => {
  it('starts from a copy of the bundled snapshot', () => {
    const set = snapshotPriceSet('KSE100');
    expect(set.prices).toEqual(SAMPLE_PRICES.KSE100);
    expect(set.edited).toBe(false);
    expect(set.prices).not.toBe(SAMPLE_PRICES.KSE100);
  });

  it('adds, rounds and flags an edited price', () => {
    const set = withPrice(snapshotPriceSet('KSE100'), 'ffc', 600.126, now);
    expect(set.prices.FFC).toBe(600.13);
    expect(set.edited).toBe(true);
    expect(set.updatedAt).toBe(now.toISOString());
  });

  it('clears a price when given null or an invalid value', () => {
    expect(Object.prototype.hasOwnProperty.call(withPrice(snapshotPriceSet('KSE100'), 'FFC', null).prices, 'FFC')).toBe(
      false,
    );
    expect(Object.prototype.hasOwnProperty.call(withPrice(snapshotPriceSet('KSE100'), 'FFC', 0).prices, 'FFC')).toBe(
      false,
    );
  });

  it('drops prices without touching the rest of the set', () => {
    const base = withPrice(snapshotPriceSet('KMI30'), 'FFC', 600, now);
    const cleared = withoutPrices(base, ['FFC', 'NOT-THERE'], now);
    expect(cleared.prices.FFC).toBeUndefined();
    expect(cleared.prices.UBL).toBe(SAMPLE_PRICES.KMI30.UBL);
    expect(cleared.edited).toBe(true);
  });

  it('merges a pasted batch and ignores invalid entries', () => {
    const set = withPrices(snapshotPriceSet('KMI30'), { FFC: 580, UBL: 0, MEBL: 560.5 }, now);
    expect(set.prices.FFC).toBe(580);
    expect(set.prices.MEBL).toBe(560.5);
    expect(set.prices.UBL).toBeUndefined();
    expect(set.edited).toBe(true);
    expect(withPrices(snapshotPriceSet('KMI30'), {})).toEqual(snapshotPriceSet('KMI30'));
  });
});

describe('loadPriceSet', () => {
  it('falls back to the snapshot when storage is unavailable', () => {
    const set = loadPriceSet('KMI30');
    expect(set.prices).toEqual(SAMPLE_PRICES.KMI30);
    expect(set.edited).toBe(false);
    expect(Number.isNaN(Date.parse(set.updatedAt))).toBe(false);
  });
});
