/** Supported PSX indices. */
export type IndexKey = 'KSE100' | 'KMI30';

/** A single index constituent, as published by PSX. */
export interface Constituent {
  /** PSX trading symbol, e.g. "FFC". */
  ticker: string;
  /** Registered company name. */
  companyName: string;
  /** PSX sector classification. */
  sector: string;
  /** Original index weightage in percent, e.g. 9.13 means 9.13%. */
  weightage: number;
}

/** Where the currently active dataset came from. */
export type DatasetOrigin = 'bundled' | 'imported' | 'live';

/**
 * A validated dataset for one index.
 *
 * `constituents` holds every validated row (e.g. all 100 KSE-100 names); the
 * calculator selects the top N at render time. Keeping the full list means an
 * imported file does not silently lose data.
 */
export interface IndexDataset {
  index: IndexKey;
  constituents: Constituent[];
  origin: DatasetOrigin;
  /** Human readable source, shown in the UI and in Excel exports. */
  sourceLabel: string;
  /** Upstream URL, when the data came from a web source. */
  sourceUrl?: string;
  /** ISO timestamp of when this dataset was produced/retrieved. */
  retrievedAt: string;
  /** Optional filename for imported datasets. */
  importedFrom?: string;
}

/** Static configuration for each index. */
export interface IndexMeta {
  key: IndexKey;
  /** Display label, e.g. "KSE-100". */
  label: string;
  /** Short label used in filenames, e.g. "KSE100". */
  slug: string;
  /** One-line description for the selector. */
  description: string;
  /** Number of top-weighted companies the strategy uses. */
  topN: number;
  /** Default multiplier for the index. */
  defaultMultiplier: number;
  /** Official PSX constituents page. */
  psxUrl: string;
  /** Label describing the bundled snapshot. */
  bundledSourceLabel: string;
}

export interface AttemptLog {
  label: string;
  ok: boolean;
  message?: string;
  /** True when the browser blocked the request because PSX sends no CORS headers. */
  corsBlocked?: boolean;
}
