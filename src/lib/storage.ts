/** Small, defensive wrapper around localStorage — all calls are best-effort. */

export const STORAGE_KEYS = {
  theme: 'psxedge.theme',
  selectedIndex: 'psxedge.index',
  investment: 'psxedge.investment',
  filters: 'psxedge.filters',
  feedUrl: 'psxedge.feedUrl',
  datasetPrefix: 'psxedge.dataset.',
  lastAttemptPrefix: 'psxedge.lastAttempt.',
} as const;

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Private mode, disabled storage, or a sandboxed iframe.
    return null;
  }
}

export function readRaw(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeRaw(key: string, value: string): void {
  try {
    getStorage()?.setItem(key, value);
  } catch {
    // Quota exceeded or storage unavailable — the app keeps working in memory.
  }
}

export function removeKey(key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // ignore
  }
}

export function readJSON<T>(key: string): T | null {
  const raw = readRaw(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    writeRaw(key, JSON.stringify(value));
  } catch {
    // ignore circular/unserialisable values
  }
}
