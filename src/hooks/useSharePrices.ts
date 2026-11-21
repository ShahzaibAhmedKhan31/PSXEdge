import { useCallback, useEffect, useState } from 'react';
import type { IndexKey } from '../types';
import {
  loadPriceSet,
  savePriceSet,
  snapshotPriceSet,
  withPrice,
  withPrices,
  withoutPrices,
  type PriceSet,
} from '../services/priceService';

function initialPriceSets(): Record<IndexKey, PriceSet> {
  return {
    KSE100: loadPriceSet('KSE100'),
    KMI30: loadPriceSet('KMI30'),
  };
}

/**
 * Per-index share prices: the bundled PSX snapshot by default, locally edited
 * prices after that. Editing one price never touches the other index.
 */
export function useSharePrices(index: IndexKey) {
  const [sets, setSets] = useState<Record<IndexKey, PriceSet>>(initialPriceSets);
  const priceSet = sets[index];

  useEffect(() => {
    savePriceSet(index, priceSet);
  }, [index, priceSet]);

  const setPrice = useCallback(
    (ticker: string, price: number | null) => {
      setSets((current) => ({ ...current, [index]: withPrice(current[index], ticker, price) }));
    },
    [index],
  );

  const applyPrices = useCallback(
    (updates: Record<string, number>, removed: readonly string[] = []) => {
      setSets((current) => {
        let next = current[index];
        if (removed.length > 0) next = withoutPrices(next, removed);
        if (Object.keys(updates).length > 0) next = withPrices(next, updates);
        return { ...current, [index]: next };
      });
    },
    [index],
  );

  const resetToSnapshot = useCallback(() => {
    setSets((current) => ({ ...current, [index]: snapshotPriceSet(index) }));
  }, [index]);

  return { priceSet, setPrice, applyPrices, resetToSnapshot };
}
