import { PRICE_SNAPSHOT, SAMPLE_PRICES } from '../data/priceSnapshot';
import { readJSON, STORAGE_KEYS, writeJSON } from '../lib/storage';
import type { IndexKey } from '../types';
import { normalisePrice } from './investmentCalculator';

/** Prices in use for one index, plus where they came from. */
export interface PriceSet {
  /** Ticker → price in PKR. Companies without a usable price are omitted. */
  prices: Record<string, number>;
  /** True once the user edits or pastes prices, so the UI can label them. */
  edited: boolean;
  /** ISO timestamp of the snapshot capture or the last edit. */
  updatedAt: string;
}

/** A PriceSet that has been edited at least once. */
export function snapshotPriceSet(index: IndexKey): PriceSet {
  return {
    prices: { ...SAMPLE_PRICES[index] },
    edited: false,
    updatedAt: PRICE_SNAPSHOT.capturedAt,
  };
}

export function priceSetLabel(set: PriceSet): string {
  return set.edited ? 'Edited in browser' : PRICE_SNAPSHOT.label;
}

/** Restore the bundled snapshot, forgetting local edits. */
export function loadPriceSet(index: IndexKey): PriceSet {
  const fallback = snapshotPriceSet(index);
  const stored = readJSON<Partial<PriceSet>>(`${STORAGE_KEYS.pricesPrefix}${index}`);
  if (!stored || typeof stored !== 'object' || !stored.prices || typeof stored.prices !== 'object') {
    return fallback;
  }

  const prices: Record<string, number> = {};
  for (const [ticker, value] of Object.entries(stored.prices)) {
    const price = normalisePrice(value);
    if (price !== null && typeof ticker === 'string' && ticker.trim() !== '') {
      prices[ticker.toUpperCase()] = price;
    }
  }
  const updatedAt =
    typeof stored.updatedAt === 'string' && !Number.isNaN(Date.parse(stored.updatedAt))
      ? stored.updatedAt
      : fallback.updatedAt;

  return { prices, edited: stored.edited === true, updatedAt };
}

export function savePriceSet(index: IndexKey, set: PriceSet): void {
  writeJSON(`${STORAGE_KEYS.pricesPrefix}${index}`, {
    prices: set.prices,
    edited: set.edited,
    updatedAt: set.updatedAt,
  });
}

/** Set or clear (null) one company's price. */
export function withPrice(set: PriceSet, ticker: string, price: number | null, now: Date = new Date()): PriceSet {
  const key = ticker.trim().toUpperCase();
  if (!key) return set;
  const next = { ...set.prices };
  const parsed = normalisePrice(price);
  if (parsed === null) {
    delete next[key];
  } else {
    next[key] = Math.round(parsed * 100) / 100;
  }
  return { prices: next, edited: true, updatedAt: now.toISOString() };
}

/** Drop prices for the given tickers (used by the paste dialog). */
export function withoutPrices(
  set: PriceSet,
  tickers: readonly string[],
  now: Date = new Date(),
): PriceSet {
  const next = { ...set.prices };
  let changed = false;
  for (const ticker of tickers) {
    const key = ticker.trim().toUpperCase();
    if (key && Object.prototype.hasOwnProperty.call(next, key)) {
      delete next[key];
      changed = true;
    }
  }
  return changed ? { prices: next, edited: true, updatedAt: now.toISOString() } : set;
}

/** Merge a batch of prices (used by the paste dialog) onto the current set. */
export function withPrices(
  set: PriceSet,
  updates: Readonly<Record<string, number>>,
  now: Date = new Date(),
): PriceSet {
  const next = { ...set.prices };
  let changed = false;
  for (const [ticker, value] of Object.entries(updates)) {
    const key = ticker.trim().toUpperCase();
    const parsed = normalisePrice(value);
    if (!key || parsed === null) continue;
    next[key] = Math.round(parsed * 100) / 100;
    changed = true;
  }
  return changed ? { prices: next, edited: true, updatedAt: now.toISOString() } : set;
}

export interface ParsedPriceList {
  /** Valid ticker → price pairs that belong to this index. */
  prices: Record<string, number>;
  /** Known tickers written as "TICKER," with no price — cleared on apply. */
  removed: string[];
  /** Tickers in the text that are not constituents of this index. */
  unknown: string[];
  /** Lines that could not be read as "TICKER, PRICE". */
  skipped: number;
}

/**
 * Read a pasted price list. Accepts comma, tab, colon, semicolon or whitespace
 * separators, optional quotes and "Rs" prefixes, e.g. "FFC, 571.30".
 */
export function parsePriceList(text: string, knownTickers: readonly string[]): ParsedPriceList {
  const known = new Set(knownTickers.map((ticker) => ticker.trim().toUpperCase()));
  const prices: Record<string, number> = {};
  const removed = new Set<string>();
  const unknown = new Set<string>();
  let skipped = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^["']|["']$/g, '');
    if (!line) continue;

    // "TICKER," with no price deliberately clears that company's price.
    const emptyMatch = line.match(/^["']?([A-Za-z0-9-]+)["']?\s*[,;:\t|]\s*$/);
    if (emptyMatch) {
      const ticker = emptyMatch[1].toUpperCase();
      if (known.has(ticker)) removed.add(ticker);
      else unknown.add(ticker);
      continue;
    }

    const match = line.match(
      /^["']?([A-Za-z0-9-]+)["']?\s*[,;\t|:]?\s*["']?(?:Rs\.?\s*)?([\d,]+(?:\.\d+)?)["']?$/i,
    );
    if (!match) {
      skipped += 1;
      continue;
    }

    const ticker = match[1].toUpperCase();
    const price = normalisePrice(match[2]);
    if (price === null) {
      skipped += 1;
      continue;
    }
    if (!known.has(ticker)) {
      unknown.add(ticker);
      continue;
    }
    prices[ticker] = Math.round(price * 100) / 100;
  }

  return { prices, removed: [...removed], unknown: [...unknown], skipped };
}

/** Serialise the current prices as "TICKER,PRICE" lines for the paste dialog. */
export function formatPriceList(tickers: readonly string[], prices: Readonly<Record<string, number>>): string {
  return tickers
    .map((ticker) => {
      const price = normalisePrice(prices[ticker]);
      return price === null ? `${ticker},` : `${ticker},${price.toFixed(2)}`;
    })
    .join('\n');
}
