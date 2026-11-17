import { describe, expect, it } from 'vitest';
import { formatAmountInput, formatCompactPKR, formatNumber, formatPKR, parseAmountInput } from './currencyFormatter';
import { formatMultiplier, formatPercent } from './percentageFormatter';

describe('formatPKR', () => {
  it('adds thousands separators and the Rs prefix', () => {
    expect(formatPKR(100_000)).toBe('Rs 100,000');
    expect(formatPKR(1_000_000)).toBe('Rs 1,000,000');
    expect(formatPKR(0)).toBe('Rs 0');
  });

  it('rounds for display only', () => {
    expect(formatPKR(1234.56)).toBe('Rs 1,235');
    expect(formatPKR(1234.4)).toBe('Rs 1,234');
  });

  it('handles negative values (over-allocation)', () => {
    expect(formatPKR(-4610)).toBe('-Rs 4,610');
  });

  it('supports explicit decimals', () => {
    expect(formatPKR(1234.5, { decimals: 2 })).toBe('Rs 1,234.50');
  });
});

describe('number helpers', () => {
  it('formats plain numbers', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(1234.5678, 2)).toBe('1,234.57');
    expect(formatNumber(Number.NaN)).toBe('—');
  });

  it('formats compact preset labels', () => {
    expect(formatCompactPKR(50_000)).toBe('50K');
    expect(formatCompactPKR(100_000)).toBe('100K');
    expect(formatCompactPKR(1_000_000)).toBe('1M');
    expect(formatCompactPKR(5_000_000)).toBe('5M');
  });
});

describe('percentage helpers', () => {
  it('formats percentages with two decimals', () => {
    expect(formatPercent(13.2)).toBe('13.20%');
    expect(formatPercent(9.13)).toBe('9.13%');
    expect(formatPercent(104.61)).toBe('104.61%');
  });

  it('formats multipliers', () => {
    expect(formatMultiplier(1.5)).toBe('1.50×');
    expect(formatMultiplier(1.1)).toBe('1.10×');
  });
});

describe('amount input handling', () => {
  it('groups digits with commas while typing', () => {
    expect(formatAmountInput('1250000')).toBe('1,250,000');
    expect(formatAmountInput('100000')).toBe('100,000');
    expect(formatAmountInput('0')).toBe('0');
    expect(formatAmountInput('0.5')).toBe('0.5');
    expect(formatAmountInput('1000.')).toBe('1,000.');
    expect(formatAmountInput('000123')).toBe('123');
    expect(formatAmountInput('abc')).toBe('');
  });

  it('parses formatted input', () => {
    expect(parseAmountInput('1,250,000')).toBe(1_250_000);
    expect(parseAmountInput('100000')).toBe(100_000);
    expect(parseAmountInput('12.5')).toBe(12.5);
  });

  it('rejects unusable input', () => {
    expect(parseAmountInput('')).toBeNull();
    expect(parseAmountInput('abc')).toBeNull();
    expect(parseAmountInput('1.2.3')).toBeNull();
  });
});
