import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INDEX_KEYS, INDEX_META, isIndexKey } from '../data/indexMeta';
import { STORAGE_KEYS, readRaw, writeRaw } from '../lib/storage';
import {
  createBundledDataset,
  clearCachedDataset,
  datasetAgeDays,
  isDatasetStale,
  loadCachedDataset,
  refreshAllIndexData,
  saveCachedDataset,
} from '../services/indexDataService';
import type { AttemptLog, IndexDataset, IndexKey } from '../types';

const MIN_ATTEMPT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface RefreshFeedback {
  ok: boolean;
  message: string;
  /** True when the browser blocked the PSX request (missing CORS headers). */
  corsBlocked: boolean;
  /** Indices that received a fresh dataset. */
  updated: IndexKey[];
}

function initialDatasets(): Record<IndexKey, IndexDataset> {
  return {
    KSE100: loadCachedDataset('KSE100') ?? createBundledDataset('KSE100'),
    KMI30: loadCachedDataset('KMI30') ?? createBundledDataset('KMI30'),
  };
}

function initialIndex(): IndexKey {
  const stored = readRaw(STORAGE_KEYS.selectedIndex);
  return isIndexKey(stored) ? stored : 'KSE100';
}

function lastAttemptKey(index: IndexKey): string {
  return `${STORAGE_KEYS.lastAttemptPrefix}${index}`;
}

export function useIndexData() {
  const [index, setIndexState] = useState<IndexKey>(initialIndex);
  const [datasets, setDatasets] = useState<Record<IndexKey, IndexDataset>>(initialDatasets);
  const [refreshing, setRefreshing] = useState(false);
  const [attempts, setAttempts] = useState<AttemptLog[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setIndex = useCallback((next: IndexKey) => {
    setIndexState(next);
    writeRaw(STORAGE_KEYS.selectedIndex, next);
  }, []);

  const dataset = datasets[index];
  const meta = INDEX_META[index];

  const refresh = useCallback(
    async (options?: { silent?: boolean }): Promise<RefreshFeedback> => {
      if (!options?.silent) setRefreshing(true);

      try {
        const outcome = await refreshAllIndexData(index);
        if (!mounted.current) {
          return { ok: false, message: 'Unmounted', corsBlocked: false, updated: [] };
        }

        setAttempts(outcome.attempts);

        if (outcome.updated.length > 0) {
          // Record the attempt only after a successful refresh: a failed refresh
          // must not start the 6-hour lock-out, otherwise the user cannot retry.
          INDEX_KEYS.forEach((key) => writeRaw(lastAttemptKey(key), String(Date.now())));
          for (const key of outcome.updated) {
            const dataset = outcome.datasets[key];
            if (dataset) saveCachedDataset(dataset);
          }
          setDatasets((current) => ({ ...current, ...outcome.datasets }));

          const refreshed = outcome.updated.map((key) => INDEX_META[key].label);
          const missing = INDEX_KEYS.filter((key) => !outcome.updated.includes(key)).map(
            (key) => INDEX_META[key].label,
          );
          const source = outcome.datasets[outcome.updated[0]]?.sourceLabel ?? 'live source';

          return {
            ok: true,
            message:
              missing.length === 0
                ? `${refreshed.join(' and ')} refreshed — ${source}.`
                : `${refreshed.join(' and ')} refreshed; ${missing.join(' and ')} kept the previous dataset.`,
            corsBlocked: outcome.corsBlocked,
            updated: outcome.updated,
          };
        }

        return {
          ok: false,
          message: `Live retrieval failed — keeping the last validated ${INDEX_KEYS.map(
            (key) => INDEX_META[key].label,
          ).join(' and ')} datasets.`,
          corsBlocked: outcome.corsBlocked,
          updated: [],
        };
      } finally {
        if (mounted.current && !options?.silent) setRefreshing(false);
      }
    },
    [index],
  );

  // One automatic attempt per session, only when any index dataset is stale.
  useEffect(() => {
    const cached = INDEX_KEYS.map((key) => loadCachedDataset(key) ?? createBundledDataset(key));
    if (!cached.some((dataset) => isDatasetStale(dataset))) return;

    const lastAttempt = Math.max(...INDEX_KEYS.map((key) => Number(readRaw(lastAttemptKey(key)) ?? 0)));
    if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < MIN_ATTEMPT_INTERVAL_MS) return;

    // Do not clobber freshly imported datasets.
    if (cached.some((dataset) => dataset.origin === 'imported' && datasetAgeDays(dataset) < 30)) return;

    void refresh({ silent: true });
    // Intentionally runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importDataset = useCallback((next: IndexDataset) => {
    saveCachedDataset(next);
    setDatasets((current) => ({ ...current, [next.index]: next }));
    setIndex(next.index);
    setAttempts([]);
  }, [setIndex]);

  const resetToBundled = useCallback(() => {
    clearCachedDataset(index);
    setDatasets((current) => ({ ...current, [index]: createBundledDataset(index) }));
  }, [index, meta.label]);

  const ageDays = useMemo(() => datasetAgeDays(dataset), [dataset]);
  const stale = isDatasetStale(dataset);

  return {
    index,
    meta,
    dataset,
    setIndex,
    refresh,
    importDataset,
    resetToBundled,
    refreshing,
    attempts,
    stale,
    ageDays,
  };
}
