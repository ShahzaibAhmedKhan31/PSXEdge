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
