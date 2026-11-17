const wholeRupees = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const twoDecimals = new Intl.NumberFormat('en-PK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "1234567" → "1,234,567" */
export function formatNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  return decimals > 0 ? twoDecimals.format(value) : wholeRupees.format(value);
}

/**
 * Format a PKR amount with thousands separators.
 * Monetary values are rounded for display only; calculations keep full precision.
 */
export function formatPKR(value: number, options?: { decimals?: number }): string {
  if (!Number.isFinite(value)) return '—';
  const decimals = options?.decimals ?? 0;
  const formatted = decimals > 0 ? twoDecimals.format(Math.abs(value)) : wholeRupees.format(Math.abs(value));
  return value < 0 ? `-Rs ${formatted}` : `Rs ${formatted}`;
}

/** Amount without the "Rs" prefix, e.g. for Excel cells. */
export function formatPKRAmount(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '0';
  return decimals > 0 ? twoDecimals.format(value) : wholeRupees.format(value);
}

/** Compact display for preset chips: 250000 → "250K", 1000000 → "1M". */
export function formatCompactPKR(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value >= 10_000_000) return `${formatNumber(value / 1_000_000, 1)}M`;
  if (value >= 1_000_000) return `${formatNumber(value / 1_000_000, value % 1_000_000 === 0 ? 0 : 1)}M`;
  if (value >= 1_000) return `${formatNumber(value / 1_000, value % 1_000 === 0 ? 0 : 0)}K`;
  return formatNumber(value);
}

/** Parse user input such as "1,250,000" or "Rs 1.2m" into a number. */
export function parseAmountInput(raw: string): number | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (cleaned.trim() === '') return null;
  if ((cleaned.match(/\./g) ?? []).length > 1) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * Format a raw digits string for a live amount input, e.g. "1250000" → "1,250,000".
 * Keeps up to two decimal places and a trailing decimal point while typing.
 */
export function formatAmountInput(raw: string): string {
  const cleaned = String(raw ?? '').replace(/[^0-9.]/g, '');
  const [integerPart, ...rest] = cleaned.split('.');
  const decimals = rest.join('').slice(0, 2);
  const normalizedInteger = (integerPart ?? '').replace(/^0+(?=\d)/, '');
  const grouped = normalizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (cleaned.includes('.')) {
    return `${grouped === '' ? '0' : grouped}.${decimals}`;
  }
  return grouped;
}
