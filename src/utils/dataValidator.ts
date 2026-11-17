import { isIndexKey, INDEX_META } from '../data/indexMeta';
import type { Constituent, IndexDataset, IndexKey, IndexMeta } from '../types';

export interface SkippedRow {
  /** 1-based row number as it appeared in the source file. */
  rowNumber: number;
  reason: string;
  raw: string;
}

export interface ImportAnalysis {
  ok: boolean;
  errors: string[];
  warnings: string[];
  /** Every valid, de-duplicated constituent, sorted by weightage (desc). */
  all: Constituent[];
  /** Top N constituents for the selected index (what the calculator uses). */
  selected: Constituent[];
  rowsRead: number;
  rowsSkipped: number;
  skipped: SkippedRow[];
  duplicates: string[];
  totalWeightage: number;
}

export interface ColumnMap {
  ticker: number;
  company: number;
  sector: number;
  weight: number;
}

const HEADER_ALIASES: Record<'ticker' | 'company' | 'sector', RegExp> = {
  ticker: /^(symbol|ticker|scrip|security\s*code|code|sym)$/i,
  company: /(company|security\s*name|name\s*of\s*(the\s*)?(company|security)|^name$)/i,
  sector: /(sector|industry)/i,
};

/** Strong weightage header, e.g. "Weightage", "IDX WTG (%)", "Index Weight". */
const STRONG_WEIGHT_HEADER = /(weight|wtg)/i;
/** Weak weightage header — only used when no strong header exists. */
const WEAK_WEIGHT_HEADER = /(%|percent)/i;
/** Columns such as "CHANGE (%)" must never be mistaken for weightage. */
const NOT_WEIGHT_HEADER = /(change|chg|pct|volume|price)/i;

const UNCLASSIFIED_SECTOR = 'Unclassified';

/** Uppercase a ticker and strip PSX decorations such as "FFC XD" or "PSX: FFC". */
export function normalizeTicker(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/\([^)]*\)/g, ' ')
    .replace(/psx\s*:/gi, ' ')
    .replace(/\b(xd|xr|xb|nc)\b/gi, ' ')
    .replace(/[^A-Za-z0-9-]/g, '')
    .trim()
    .toUpperCase();
}

/** "9.13%" → 9.13, "1,234" → 1234, "" → null. */
export function parseWeightage(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[%\s,]/g, '').replace(/rs\.?/gi, '');
  if (cleaned === '' || cleaned === '-') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return value;
}

/** Identify which column holds what, using the header row when present. */
export function detectColumns(headerCells: readonly string[]): ColumnMap | null {
  const map: ColumnMap = { ticker: -1, company: -1, sector: -1, weight: -1 };
  let matched = 0;

  const labels = headerCells.map((cell) => String(cell ?? '').trim());

  labels.forEach((label, index) => {
    if (!label || label.length > 60) return;
    for (const key of Object.keys(HEADER_ALIASES) as (keyof typeof HEADER_ALIASES)[]) {
      if (map[key] === -1 && HEADER_ALIASES[key].test(label)) {
        map[key] = index;
        matched += 1;
        return;
      }
    }
  });

  // Weightage gets a dedicated pass so "CHANGE (%)" never wins over "IDX WTG (%)".
  const strongIndex = labels.findIndex((label) => STRONG_WEIGHT_HEADER.test(label) && !NOT_WEIGHT_HEADER.test(label));
  const weakIndex = labels.findIndex((label) => WEAK_WEIGHT_HEADER.test(label) && !NOT_WEIGHT_HEADER.test(label));
  map.weight = strongIndex >= 0 ? strongIndex : weakIndex;
  if (map.weight >= 0) matched += 1;

  if (matched === 0) return null;
  // A header must at least identify the ticker and the weight column.
  if (map.ticker === -1 || map.weight === -1) return null;
  return map;
}

/**
 * Work out where the data starts and which column is which.
 * Supports files with a header row and headerless files (assumed order:
 * ticker, company, sector, weightage).
 */
export function resolveLayout(rows: readonly string[][]): {
  columns: ColumnMap;
  startIndex: number;
  hasHeader: boolean;
} {
  const first = rows[0] ?? [];
  const detected = detectColumns(first);
  if (detected) {
    return { columns: detected, startIndex: 1, hasHeader: true };
  }

  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  let columns: ColumnMap;
  if (width >= 4) {
    columns = { ticker: 0, company: 1, sector: 2, weight: 3 };
  } else if (width === 3) {
    columns = { ticker: 0, company: 1, sector: -1, weight: 2 };
  } else if (width === 2) {
    columns = { ticker: 0, company: -1, sector: -1, weight: 1 };
  } else {
    columns = { ticker: -1, company: -1, sector: -1, weight: -1 };
  }

  return { columns, startIndex: 0, hasHeader: false };
}

function cellAt(row: readonly string[], index: number): string {
  if (index < 0 || index >= row.length) return '';
  return String(row[index] ?? '').trim();
}

/**
 * Clean, validate, de-duplicate and sort a list of constituents.
 * `meta` decides how many rows the strategy needs.
 */
export function analyzeConstituents(
  inputRows: readonly Constituent[],
  meta: IndexMeta,
  context?: { rowsRead?: number; skipped?: SkippedRow[] },
): ImportAnalysis {
  const errors: string[] = [];
  const warnings: string[] = [];
  const skipped = [...(context?.skipped ?? [])];
  const duplicates: string[] = [];
  const seen = new Set<string>();
  const valid: Constituent[] = [];

  for (const candidate of inputRows) {
    const ticker = normalizeTicker(candidate.ticker);
    const companyName = String(candidate.companyName ?? '').trim();
    const sector = String(candidate.sector ?? '').trim();
    const weightage = parseWeightage(candidate.weightage);

    if (!ticker) {
      skipped.push({ rowNumber: 0, reason: 'Missing ticker', raw: JSON.stringify(candidate) });
      continue;
    }
    if (weightage === null || weightage < 0 || weightage > 100) {
      skipped.push({ rowNumber: 0, reason: `Invalid weightage for ${ticker}`, raw: JSON.stringify(candidate) });
      continue;
    }
    if (/^(TOTAL|SUM|GRANDTOTAL|INDEXTOTAL)$/.test(ticker)) {
      skipped.push({ rowNumber: 0, reason: 'Summary row ignored', raw: ticker });
      continue;
    }
    if (seen.has(ticker)) {
      duplicates.push(ticker);
      continue;
    }
    seen.add(ticker);
    valid.push({
      ticker,
      companyName: companyName || ticker,
      sector: sector || UNCLASSIFIED_SECTOR,
      weightage,
    });
  }

  valid.sort((a, b) => (b.weightage !== a.weightage ? b.weightage - a.weightage : a.ticker.localeCompare(b.ticker)));
  const totalWeightage = Math.round(valid.reduce((sum, c) => sum + c.weightage, 0) * 100) / 100;
  const selected = valid.slice(0, meta.topN);

  if (valid.length === 0) {
    errors.push('No valid rows found. Check that the file has ticker, company name, sector and weightage columns.');
  } else if (valid.length < meta.topN) {
    errors.push(
      `Only ${valid.length} valid ${valid.length === 1 ? 'company' : 'companies'} found — the ${meta.label} strategy needs at least ${meta.topN} (top ${meta.topN} by weightage).`,
    );
  }

  if (skipped.length > 0) {
    warnings.push(`${skipped.length} ${skipped.length === 1 ? 'row was' : 'rows were'} skipped because of missing or invalid data.`);
  }
  if (duplicates.length > 0) {
    warnings.push(`Duplicate tickers ignored: ${[...new Set(duplicates)].join(', ')}.`);
  }
  if (valid.length > 0 && (totalWeightage < 80 || totalWeightage > 120)) {
    warnings.push(
      `Total weightage is ${totalWeightage.toFixed(2)}% — index weightages normally sum to roughly 100%. Double-check the file was not scaled differently.`,
    );
  }
  if (valid.some((c) => c.sector === UNCLASSIFIED_SECTOR)) {
    const count = valid.filter((c) => c.sector === UNCLASSIFIED_SECTOR).length;
    warnings.push(`${count} ${count === 1 ? 'company has' : 'companies have'} no sector; shown as "${UNCLASSIFIED_SECTOR}".`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    all: valid,
    selected,
    rowsRead: context?.rowsRead ?? inputRows.length,
    rowsSkipped: skipped.length,
    skipped,
    duplicates,
    totalWeightage,
  };
}

/** Turn a raw spreadsheet matrix (CSV or XLSX rows) into validated constituents. */
export function analyzeTable(rows: readonly string[][], meta: IndexMeta): ImportAnalysis {
  const nonEmpty = rows.filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''));
  if (nonEmpty.length === 0) {
    return {
      ok: false,
      errors: ['The file appears to be empty.'],
      warnings: [],
      all: [],
      selected: [],
      rowsRead: 0,
      rowsSkipped: 0,
      skipped: [],
      duplicates: [],
      totalWeightage: 0,
    };
  }

  const { columns, startIndex, hasHeader } = resolveLayout(nonEmpty);

  if (columns.weight === -1) {
    return {
      ok: false,
      errors: [
        'Could not find a weightage column. Include a header such as "Ticker, Company Name, Sector, Weightage" or put weightage in the last column.',
      ],
      warnings: [],
      all: [],
      selected: [],
      rowsRead: nonEmpty.length,
      rowsSkipped: 0,
      skipped: [],
      duplicates: [],
      totalWeightage: 0,
    };
  }

  const cleanedCandidates: Constituent[] = [];
  const skipped: SkippedRow[] = [];

  nonEmpty.slice(startIndex).forEach((row, offset) => {
    const rowNumber = startIndex + offset + 1;
    const ticker = cellAt(row, columns.ticker);
    const weightRaw = cellAt(row, columns.weight);
    const company = cellAt(row, columns.company);
    const sector = cellAt(row, columns.sector);

    if (!ticker && !weightRaw) return; // blank row
    if (/^(total|sum|grand\s*total|index\s*total)$/i.test(ticker.trim())) return; // summary row

    const weight = parseWeightage(weightRaw);
    if (!normalizeTicker(ticker)) {
      skipped.push({ rowNumber, reason: 'Missing ticker', raw: row.join(' | ') });
      return;
    }
    if (weight === null || weight < 0 || weight > 100) {
      skipped.push({ rowNumber, reason: `Invalid weightage "${weightRaw}"`, raw: row.join(' | ') });
      return;
    }

    cleanedCandidates.push({
      ticker,
      companyName: company || normalizeTicker(ticker),
      sector,
      weightage: weight,
    });
  });

  const analysis = analyzeConstituents(cleanedCandidates, meta, {
    rowsRead: Math.max(nonEmpty.length - startIndex, 0),
    skipped,
  });

  if (hasHeader && analysis.ok) {
    analysis.warnings.unshift('Header row detected and skipped.');
  }

  return analysis;
}

/** Shape check used before trusting a cached dataset. */
export function isValidDataset(value: unknown, expectedIndex?: IndexKey): value is IndexDataset {
  if (!value || typeof value !== 'object') return false;
  const dataset = value as Partial<IndexDataset>;
  if (!isIndexKey(dataset.index)) return false;
  if (expectedIndex && dataset.index !== expectedIndex) return false;
  if (!Array.isArray(dataset.constituents) || dataset.constituents.length === 0) return false;
  if (typeof dataset.retrievedAt !== 'string' || Number.isNaN(Date.parse(dataset.retrievedAt))) return false;
  if (dataset.origin !== 'bundled' && dataset.origin !== 'imported' && dataset.origin !== 'live') return false;

  const meta = INDEX_META[dataset.index];
  if (!meta) return false;

  return dataset.constituents.every(
    (c) =>
      !!c &&
      typeof c.ticker === 'string' &&
      c.ticker.trim() !== '' &&
      typeof c.companyName === 'string' &&
      typeof c.sector === 'string' &&
      typeof c.weightage === 'number' &&
      Number.isFinite(c.weightage) &&
      c.weightage >= 0 &&
      c.weightage <= 100,
  );
}

/** Normalise a list of constituents for storage (ticker uppercase, sorted). */
export function normalizeConstituents(list: readonly Constituent[], topN?: number): Constituent[] {
  const sorted = [...list]
    .map((c) => ({
      ticker: normalizeTicker(c.ticker),
      companyName: c.companyName.trim() || normalizeTicker(c.ticker),
      sector: c.sector?.trim() || UNCLASSIFIED_SECTOR,
      weightage: Math.round(c.weightage * 1000) / 1000,
    }))
    .filter((c) => c.ticker !== '')
    .sort((a, b) => (b.weightage !== a.weightage ? b.weightage - a.weightage : a.ticker.localeCompare(b.ticker)));
  return topN ? sorted.slice(0, topN) : sorted;
}
