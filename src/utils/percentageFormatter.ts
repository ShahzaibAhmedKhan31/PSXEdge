/** "13.2" → "13.20%" */
export function formatPercent(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}

/** "1.5" → "1.50×" */
export function formatMultiplier(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(2)}×`;
}

/** "1.5" → "1.50" (plain, for inputs) */
export function formatMultiplierInput(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2);
}

/**
 * Multiplier display for the auto-derived value, e.g. "1.0001×", "2.00×".
 * Keeps up to four decimals but never fewer than two.
 */
export function formatMultiplierAuto(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  const trimmed = value.toFixed(4).replace(/0+$/, '');
  if (trimmed.endsWith('.')) return `${trimmed}00×`;
  const decimals = trimmed.split('.')[1] ?? '';
  return decimals.length === 1 ? `${trimmed}0×` : `${trimmed}×`;
}
