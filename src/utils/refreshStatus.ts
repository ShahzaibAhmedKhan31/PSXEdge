import { INDEX_KEYS, INDEX_META } from '../data/indexMeta';
import type { AttemptLog, IndexKey } from '../types';

export interface RefreshStatus {
  /** Indices that received fresh data from at least one source. */
  succeeded: IndexKey[];
  /** Indices that were attempted but produced no fresh dataset. */
  failed: IndexKey[];
  /** True only when every source failed and the browser blocked a request. */
  corsBlocked: boolean;
  /** Failed attempts whose index still refreshed through another source. */
  ignoredFailures: AttemptLog[];
  /** Failed attempts that left their index on the previous dataset. */
  blockingFailures: AttemptLog[];
}

/** The index an attempt belongs to, from its "KSE-100 · …" label. */
export function attemptIndex(label: string): IndexKey | null {
  const key = INDEX_KEYS.find((candidate) => label.startsWith(`${INDEX_META[candidate].label} · `));
  return key ?? null;
}

/**
 * Interpret the flat attempt log of a refresh.
 *
 * A failed *optional* source (for example a stale custom feed) must never be
 * presented as "PSX blocked the refresh" when the proxy then succeeded — that
 * was the confusing part of the old UI. Only attempts that leave their index
 * without fresh data count as blocking.
 */
export function analyseRefreshAttempts(attempts: readonly AttemptLog[]): RefreshStatus {
  const succeeded = new Set<IndexKey>();
  const attempted = new Set<IndexKey>();

  for (const attempt of attempts) {
    const key = attemptIndex(attempt.label);
    if (!key) continue;
    attempted.add(key);
    if (attempt.ok) succeeded.add(key);
  }

  const ignoredFailures: AttemptLog[] = [];
  const blockingFailures: AttemptLog[] = [];

  for (const attempt of attempts) {
    if (attempt.ok) continue;
    const key = attemptIndex(attempt.label);
    if (!key) continue; // not tied to a supported index — does not affect refresh status
    if (succeeded.has(key)) ignoredFailures.push(attempt);
    else blockingFailures.push(attempt);
  }

  return {
    succeeded: INDEX_KEYS.filter((key) => succeeded.has(key)),
    failed: INDEX_KEYS.filter((key) => attempted.has(key) && !succeeded.has(key)),
    corsBlocked: blockingFailures.some((attempt) => attempt.corsBlocked === true),
    ignoredFailures,
    blockingFailures,
  };
}
