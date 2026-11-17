import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INDEX_META, isIndexKey } from '../data/indexMeta';
import { STORAGE_KEYS, readRaw, writeRaw } from '../lib/storage';
import {
  createBundledDataset,
  clearCachedDataset,
  datasetAgeDays,
  isDatasetStale,
  loadCachedDataset,
  refreshIndexData,
  saveCachedDataset,
} from '../services/indexDataService';
import type { AttemptLog, IndexDataset, IndexKey } from '../types';

const MIN_ATTEMPT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export interface RefreshFeedback {
  ok: boolean;
  message: string;
  /** True when the browser blocked the PSX request (missing CORS headers). */
  corsBlocked: boolean;
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
      writeRaw(lastAttemptKey(index), String(Date.now()));
      if (!options?.silent) setRefreshing(true);

      try {
        const outcome = await refreshIndexData(index);
        if (!mounted.current) return { ok: false, message: 'Unmounted', corsBlocked: false };

        setAttempts(outcome.attempts);

        if (outcome.dataset) {
          saveCachedDataset(outcome.dataset);
          setDatasets((current) => ({ ...current, [outcome.dataset!.index]: outcome.dataset! }));
          return { ok: true, message: `${meta.label} data updated.`, corsBlocked: false };
        }

        return {
          ok: false,
          message: `Live retrieval failed — keeping the last validated ${meta.label} dataset.`,
          corsBlocked: outcome.corsBlocked,
        };
      } finally {
        if (mounted.current && !options?.silent) setRefreshing(false);
      }
    },
    [index, meta.label],
  );

  // One automatic attempt per session, only when the current dataset is stale.
  useEffect(() => {
    const current = loadCachedDataset(index) ?? createBundledDataset(index);
    if (!isDatasetStale(current)) return;
    const lastAttempt = Number(readRaw(lastAttemptKey(index)) ?? 0);
    if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < MIN_ATTEMPT_INTERVAL_MS) return;

    // Do not clobber a freshly imported dataset.
    const cached = loadCachedDataset(index);
    if (cached && cached.origin === 'imported' && datasetAgeDays(cached) < 30) return;
    void refresh({ silent: true });
    // Intentionally runs once per mount for the initially selected index.
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
