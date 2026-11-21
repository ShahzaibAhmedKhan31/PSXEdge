import { BUNDLED_SNAPSHOT_DATE, INDEX_KEYS, INDEX_META } from '../data/indexMeta';
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
 * an `Access-Control-Allow-Origin` header, so browsers cannot read a direct
 * cross-origin request. A same-origin proxy avoids the restriction entirely.
 */
export const CORS_SUMMARY =
  "PSX's Data Portal (dps.psx.com.pk) does not send an Access-Control-Allow-Origin header, so browsers block direct cross-origin requests to it.";

/**
 * Same-origin prefix that is proxied to PSX.
 *
 * - On Vercel this is a rewrite in `vercel.json` (`/psx/:path*` → dps.psx.com.pk).
 * - Locally the Vite dev/preview server proxies the same prefix.
 *
 * No server code is involved: the host forwards the request, so the app stays a
 * static frontend and the response is same-origin.
 */
export const PSX_PROXY_PREFIX = '/psx';

export const PROXY_UNAVAILABLE_MESSAGE =
  'Proxy not available from this host. The /psx rewrite is configured for Vercel (and the Vite dev server).';

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
  if (cached.constituents.length < meta.minConstituents) return null;
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

/** True for PSX's own hosts, which can never be read directly by a browser. */
export function isPsxUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'psx.com.pk' || host.endsWith('.psx.com.pk');
  } catch {
    return false;
  }
}

function feedHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'custom URL';
  }
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

/** A table of text cells extracted from PSX's index page. */
export interface PsxTableData {
  headers: string[];
  rows: string[][];
}

/**
 * Pure extraction of constituents from a PSX-style table (SYMBOL / NAME / IDX WTG (%)).
 * Split out from the DOM parsing so it can be unit-tested without a browser.
 */
export function constituentsFromTable(table: PsxTableData): Constituent[] {
  const headers = table.headers.map((header) => String(header ?? '').trim().toLowerCase());
  const symbolIndex = headers.findIndex((label) => /symbol|ticker/.test(label));
  const nameIndex = headers.findIndex((label) => /^name$|company/.test(label));
  const weightIndex = headers.findIndex((label) => /wtg|weight/.test(label));
  if (symbolIndex === -1 || weightIndex === -1) return [];

  const lookup = sectorLookup();
  const constituents: Constituent[] = [];

  for (const cells of table.rows) {
    if (!Array.isArray(cells) || cells.length <= weightIndex) continue;
    const ticker = normalizeTicker(cells[symbolIndex] ?? '');
    const weightage = parseWeightage(cells[weightIndex] ?? '');
    if (!ticker || weightage === null || weightage <= 0 || weightage > 100) continue;
    const known = lookup.get(ticker);
    const companyName = (nameIndex >= 0 ? String(cells[nameIndex] ?? '').trim() : '') || known?.companyName || ticker;
    constituents.push({
      ticker,
      companyName,
      sector: known?.sector ?? 'Unclassified',
      weightage,
    });
  }

  return constituents;
}

/**
 * Parse PSX's server-rendered index page (dps.psx.com.pk/indices/...).
 * Used for both the proxied response and a (normally CORS-blocked) direct fetch.
 * Kept defensive: PSX can change markup at any time.
 */
export function parsePsxIndexHtml(html: string): Constituent[] {
  if (typeof DOMParser === 'undefined') return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');

  for (const table of Array.from(doc.querySelectorAll('table'))) {
    const allRows = Array.from(table.querySelectorAll('tr'));
    if (allRows.length < 2) continue;

    const headers = Array.from(allRows[0].querySelectorAll('th,td')).map((cell) => (cell.textContent ?? '').trim());
    const rows = allRows
      .slice(1)
      .map((row) => Array.from(row.querySelectorAll('td')).map((cell) => (cell.textContent ?? '').trim()));

    const constituents = constituentsFromTable({ headers, rows });
    if (constituents.length > 0) return constituents;
  }

  return [];
}

/** Map an official PSX index URL onto the same-origin proxy path. */
export function proxyPathFor(meta: { psxUrl: string }): string {
  try {
    return `${PSX_PROXY_PREFIX}${new URL(meta.psxUrl).pathname}`;
  } catch {
    return PSX_PROXY_PREFIX;
  }
}

/**
 * Fetch the index page through the same-origin proxy. Because the URL is
 * same-origin, no CORS header is needed and the browser exposes the HTML.
 */
/** Append a cache-busting query so each refresh hits PSX fresh instead of a cached/error page. */
function cacheBust(path: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}_t=${Date.now()}`;
}

/** Fetch a single proxy attempt, returning the dataset on success or an error message. */
async function fetchProxyOnce(
  path: string,
  index: IndexKey,
  meta: (typeof INDEX_META)[IndexKey],
): Promise<{ dataset: IndexDataset | null; message?: string }> {
  try {
    const response = await fetchWithTimeout(cacheBust(path));
    if (!response.ok) {
      return {
        dataset: null,
        message:
          response.status === 404
            ? `${PROXY_UNAVAILABLE_MESSAGE} (HTTP 404)`
            : `The proxy responded with HTTP ${response.status}.`,
      };
    }

    const html = await response.text();
    const parsed = parsePsxIndexHtml(html);
    if (parsed.length === 0) {
      return { dataset: null, message: 'The proxy responded, but no PSX constituent rows could be read.' };
    }

    const analysis = analyzeConstituents(parsed, meta);
    if (!analysis.ok) return { dataset: null, message: analysis.errors.join(' ') };

    return {
      dataset: buildDataset({
        index,
        constituents: analysis.all,
        origin: 'live',
        sourceLabel: 'PSX Data Portal — live via same-origin proxy',
        sourceUrl: meta.psxUrl,
      }),
    };
  } catch (error) {
    return {
      dataset: null,
      message: error instanceof Error ? error.message : 'Request failed.',
    };
  }
}

/** Fetch through the same-origin proxy, retrying once on a transient failure. */
async function attemptPsxProxy(index: IndexKey): Promise<{ dataset: IndexDataset | null; attempts: AttemptLog[] }> {
  const meta = INDEX_META[index];
  const path = proxyPathFor(meta);
  const label = `PSX proxy (${path})`;

  // Try once, then retry once on failure — transient proxy hiccups (rate
  // limiting, a momentary 500) should not kill a whole refresh. The first
  // error is reported so the user sees the real proxy status (e.g. HTTP 500).
  let firstMessage = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await fetchProxyOnce(path, index, meta);
    if (result.dataset) {
      return { dataset: result.dataset, attempts: [{ label, ok: true }] };
    }
    if (!firstMessage) firstMessage = result.message ?? '';
  }

  return {
    dataset: null,
    attempts: [{ label, ok: false, message: firstMessage || 'The proxy could not be reached.', corsBlocked: false }],
  };
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
  const label = `Custom feed (${feedHost(feedUrl)})`;
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
    if (isPsxUrl(feedUrl)) {
      // A saved PSX URL can never work in a browser; skip it quietly instead of
      // reporting a fake CORS block on every refresh.
      attempts.push({
        label: `Custom feed (${feedHost(feedUrl)})`,
        ok: false,
        message:
          'The saved feed points at PSX itself, which blocks browser requests. Using the /psx proxy instead — clear the feed URL in the import dialog if you do not use one.',
        corsBlocked: false,
      });
    } else {
      const result = await attemptCustomFeed(index, feedUrl);
      attempts.push(...result.attempts);
      if (result.dataset) return { dataset: result.dataset, attempts, corsBlocked: false };
    }
  }

  const proxyResult = await attemptPsxProxy(index);
  attempts.push(...proxyResult.attempts);
  if (proxyResult.dataset) return { dataset: proxyResult.dataset, attempts, corsBlocked: false };

  // Last resort: a direct request (only works if PSX ever adds CORS headers, or
  // when the request is made from an environment that is not CORS-restricted).
  const psxResult = await attemptPsxPage(index);
  attempts.push(...psxResult.attempts);
  if (psxResult.dataset) return { dataset: psxResult.dataset, attempts, corsBlocked: false };

  return {
    dataset: null,
    attempts,
    corsBlocked: attempts.some((attempt) => attempt.corsBlocked === true),
  };
}

export interface MultiRefreshOutcome {
  /** Datasets produced by this refresh, keyed by index. */
  datasets: Partial<Record<IndexKey, IndexDataset>>;
  /** Flat attempt log, labelled with the index each attempt belongs to. */
  attempts: AttemptLog[];
  corsBlocked: boolean;
  /** Indices that produced a fresh, validated dataset. */
  updated: IndexKey[];
}

/**
 * Refresh every supported index in a single action.
 *
 * A custom feed is only applied to `activeIndex`: the documented JSON payload
 * carries no index marker, so using it for both indices could attach KSE-100
 * weights to KMI-30. The `/psx` proxy is index-specific, so it serves both.
 */
export async function refreshAllIndexData(
  activeIndex: IndexKey,
  feedUrl = getCustomFeedUrl(),
): Promise<MultiRefreshOutcome> {
  const results = await Promise.all(
    INDEX_KEYS.map(async (key) => ({
      key,
      outcome: await refreshIndexData(key, key === activeIndex ? feedUrl : ''),
    })),
  );

  const datasets: Partial<Record<IndexKey, IndexDataset>> = {};
  const updated: IndexKey[] = [];
  const attempts: AttemptLog[] = [];
  let corsBlocked = false;

  for (const { key, outcome } of results) {
    if (outcome.dataset) {
      datasets[key] = outcome.dataset;
      updated.push(key);
    }
    for (const attempt of outcome.attempts) {
      attempts.push({ ...attempt, label: `${INDEX_META[key].label} · ${attempt.label}` });
    }
    corsBlocked = corsBlocked || outcome.corsBlocked;
  }

  return { datasets, attempts, corsBlocked, updated };
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
