import { BUNDLED_SNAPSHOT_DATE, INDEX_META } from '../data/indexMeta';
import { SAMPLE_KMI30 } from '../data/sampleKMI30';
import { SAMPLE_KSE100 } from '../data/sampleKSE100';
import { STORAGE_KEYS, readRaw, readJSON, removeKey, writeJSON } from '../lib/storage';
import type { AttemptLog, Constituent, IndexDataset, IndexKey } from '../types';
import { analyzeConstituents, isValidDataset, normalizeTicker, parseWeightage } from '../utils/dataValidator';

export const BUNDLED_CONSTITUENTS: Record<IndexKey, readonly Constituent[]> = {
  KSE100: SAMPLE_KSE100,
  KMI30: SAMPLE_KMI30,
};

/** Datasets are flagged as stale after this many days. */
export const STALE_AFTER_DAYS = 7;

const REQUEST_TIMEOUT_MS = 8000;

/**
 * Shown in the UI and docs. PSX's data portal answers with HTML/JSON but without
 * an `Access-Control-Allow-Origin` header, so no website can read it directly.
 */
export const CORS_SUMMARY =
  "PSX's Data Portal (dps.psx.com.pk) does not send an Access-Control-Allow-Origin header, so browsers block every cross-origin request to it.";

export interface RefreshOutcome {
  dataset: IndexDataset | null;
  attempts: AttemptLog[];
  /** True when the PSX attempt was blocked by the browser (CORS). */
  corsBlocked: boolean;
}

function datasetStorageKey(index: IndexKey): string {
  return `${STORAGE_KEYS.datasetPrefix}${index}`;
}

/** The bundled, clearly-labelled snapshot used when nothing better is available. */
export function createBundledDataset(index: IndexKey): IndexDataset {
  const meta = INDEX_META[index];
  return {
    index,
    constituents: [...BUNDLED_CONSTITUENTS[index]].sort((a, b) => b.weightage - a.weightage),
    origin: 'bundled',
    sourceLabel: meta.bundledSourceLabel,
    sourceUrl: meta.psxUrl,
    retrievedAt: BUNDLED_SNAPSHOT_DATE,
  };
}

/** Load the last successfully validated dataset for an index, if any. */
export function loadCachedDataset(index: IndexKey): IndexDataset | null {
  const cached = readJSON<unknown>(datasetStorageKey(index));
  if (!isValidDataset(cached, index)) return null;
  const meta = INDEX_META[index];
  if (cached.constituents.length < meta.topN) return null;
  return cached;
}

export function saveCachedDataset(dataset: IndexDataset): void {
  if (!isValidDataset(dataset, dataset.index)) return;
  writeJSON(datasetStorageKey(dataset.index), dataset);
}

export function clearCachedDataset(index: IndexKey): void {
  removeKey(datasetStorageKey(index));
}

export function getCustomFeedUrl(): string {
  return (readRaw(STORAGE_KEYS.feedUrl) ?? '').trim();
}

export function datasetAgeDays(dataset: IndexDataset, now: Date = new Date()): number {
  const retrieved = Date.parse(dataset.retrievedAt);
  if (Number.isNaN(retrieved)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (now.getTime() - retrieved) / 86_400_000);
}

export function isDatasetStale(dataset: IndexDataset, now: Date = new Date()): boolean {
  return datasetAgeDays(dataset, now) > STALE_AFTER_DAYS;
}

/** Build a dataset object from validated rows. */
export function buildDataset(params: {
  index: IndexKey;
  constituents: Constituent[];
  origin: IndexDataset['origin'];
  sourceLabel: string;
  sourceUrl?: string;
  retrievedAt?: string;
  importedFrom?: string;
}): IndexDataset {
  const meta = INDEX_META[params.index];
  const analysis = analyzeConstituents(params.constituents, meta);
  if (!analysis.ok) {
    throw new Error(analysis.errors.join(' '));
  }
  return {
    index: params.index,
    constituents: analysis.all,
    origin: params.origin,
    sourceLabel: params.sourceLabel,
    sourceUrl: params.sourceUrl,
    retrievedAt: params.retrievedAt ?? new Date().toISOString(),
    importedFrom: params.importedFrom,
  };
}

/** Sector lookup built from the bundled snapshots, used to enrich live data. */
function sectorLookup(): Map<string, { sector: string; companyName: string }> {
  const map = new Map<string, { sector: string; companyName: string }>();
  for (const list of Object.values(BUNDLED_CONSTITUENTS)) {
    for (const company of list) {
      map.set(company.ticker, { sector: company.sector, companyName: company.companyName });
    }
  }
  return map;
}

async function fetchWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse PSX's server-rendered index page (dps.psx.com.pk/indices/...).
 * Kept defensive: PSX can change markup at any time, and a browser will
 * normally never get this far because the endpoint has no CORS headers.
 */
export function parsePsxIndexHtml(html: string): Constituent[] {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const table of Array.from(doc.querySelectorAll('table'))) {
    const allRows = Array.from(table.querySelectorAll('tr'));
    if (allRows.length < 2) continue;

    const headerCells = Array.from(allRows[0].querySelectorAll('th,td')).map((cell) =>
      (cell.textContent ?? '').trim().toLowerCase(),
    );
    const symbolIndex = headerCells.findIndex((label) => /symbol|ticker/.test(label));
    const nameIndex = headerCells.findIndex((label) => /^name$|company/.test(label));
    const weightIndex = headerCells.findIndex((label) => /wtg|weight/.test(label));
    if (symbolIndex === -1 || weightIndex === -1) continue;

    const lookup = sectorLookup();
    const constituents: Constituent[] = [];

    for (const row of allRows.slice(1)) {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length <= weightIndex) continue;
      const ticker = normalizeTicker(cells[symbolIndex]?.textContent ?? '');
      const weightage = parseWeightage(cells[weightIndex]?.textContent ?? '');
      if (!ticker || weightage === null || weightage <= 0 || weightage > 100) continue;
      const known = lookup.get(ticker);
      const companyName =
        (nameIndex >= 0 ? cells[nameIndex]?.textContent?.trim() : undefined) ?? known?.companyName ?? ticker;
      constituents.push({
        ticker,
        companyName,
        sector: known?.sector ?? 'Unclassified',
        weightage,
      });
    }

    if (constituents.length > 0) return constituents;
  }

  return [];
}

export interface FetchErrorInfo {
  message: string;
  corsBlocked: boolean;
}

/**
 * Classify a fetch failure. A `TypeError` is what the browser throws for both a
 * CORS rejection and an offline network failure; PSX is reachable and simply
 * omits CORS headers, so this is treated as a CORS block.
 */
export function classifyFetchError(error: unknown): FetchErrorInfo {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return { message: 'The request timed out after 8 seconds.', corsBlocked: false };
  }
  if (error instanceof TypeError) {
    return {
      message: `Blocked by the browser (CORS). ${CORS_SUMMARY}`,
      corsBlocked: true,
    };
  }
  return {
    message: error instanceof Error ? error.message : 'Unknown network error.',
    corsBlocked: false,
  };
}

async function attemptPsxPage(index: IndexKey): Promise<{ dataset: IndexDataset | null; attempts: AttemptLog[] }> {
  const meta = INDEX_META[index];
  const label = `PSX Data Portal (${meta.psxUrl.replace('https://', '')})`;
  try {
    const response = await fetchWithTimeout(meta.psxUrl);
    if (!response.ok) {
      throw new Error(`PSX responded with HTTP ${response.status}.`);
    }
    const html = await response.text();
    const parsed = parsePsxIndexHtml(html);
    if (parsed.length === 0) {
      throw new Error('PSX responded, but no constituent rows could be read from the page.');
    }
    const analysis = analyzeConstituents(parsed, meta);
    if (!analysis.ok) {
      throw new Error(analysis.errors.join(' '));
    }
    const dataset = buildDataset({
      index,
      constituents: analysis.all,
      origin: 'live',
      sourceLabel: 'PSX Data Portal (live fetch)',
      sourceUrl: meta.psxUrl,
    });
    return { dataset, attempts: [{ label, ok: true }] };
  } catch (error) {
    const failure = classifyFetchError(error);
    return {
      dataset: null,
      attempts: [{ label, ok: false, message: failure.message, corsBlocked: failure.corsBlocked }],
    };
  }
}

function extractFeedRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    for (const key of ['constituents', 'companies', 'rows', 'data']) {
      const value = record[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function toConstituent(raw: unknown): Constituent | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const ticker = normalizeTicker(String(record.ticker ?? record.symbol ?? record.sym ?? ''));
  const weightage = parseWeightage(
    (record.weightage ?? record.weight ?? record.wtg ?? record['indexWeight'] ?? record['idxWtg']) as
      | string
      | number
      | undefined,
  );
  if (!ticker || weightage === null) return null;
  return {
    ticker,
    companyName: String(record.companyName ?? record.company ?? record.name ?? ticker),
    sector: String(record.sector ?? 'Unclassified'),
    weightage,
  };
}

async function attemptCustomFeed(index: IndexKey, feedUrl: string): Promise<{ dataset: IndexDataset | null; attempts: AttemptLog[] }> {
  const meta = INDEX_META[index];
  const label = 'Custom CORS-enabled feed';
  try {
    const response = await fetchWithTimeout(feedUrl);
    if (!response.ok) throw new Error(`Feed responded with HTTP ${response.status}.`);
    const payload: unknown = await response.json();
    const rows = extractFeedRows(payload)
      .map(toConstituent)
      .filter((row): row is Constituent => row !== null);
    if (rows.length === 0) throw new Error('Feed returned no recognisable constituent rows.');
    const analysis = analyzeConstituents(rows, meta);
    if (!analysis.ok) throw new Error(analysis.errors.join(' '));
    const dataset = buildDataset({
      index,
      constituents: analysis.all,
      origin: 'live',
      sourceLabel: `Live feed (${new URL(feedUrl).hostname})`,
      sourceUrl: feedUrl,
    });
    return { dataset, attempts: [{ label, ok: true }] };
  } catch (error) {
    const failure = classifyFetchError(error);
    return {
      dataset: null,
      attempts: [{ label, ok: false, message: failure.message, corsBlocked: failure.corsBlocked }],
    };
  }
}

/**
 * Try to retrieve fresher data from the sources a browser can actually reach.
 * Nothing is written to cache here; the caller validates and persists only on
 * success.
 */
export async function refreshIndexData(index: IndexKey, feedUrl = getCustomFeedUrl()): Promise<RefreshOutcome> {
  const attempts: AttemptLog[] = [];

  if (feedUrl) {
    const result = await attemptCustomFeed(index, feedUrl);
    attempts.push(...result.attempts);
    if (result.dataset) return { dataset: result.dataset, attempts, corsBlocked: false };
  }

  const psxResult = await attemptPsxPage(index);
  attempts.push(...psxResult.attempts);
  if (psxResult.dataset) return { dataset: psxResult.dataset, attempts, corsBlocked: false };

  return {
    dataset: null,
    attempts,
    corsBlocked: attempts.some((attempt) => attempt.corsBlocked === true),
  };
}

/** Format an ISO date for display, e.g. "17 Nov 2026, 10:30". */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}
