import type { IndexKey, IndexMeta } from '../types';

/** ISO timestamp of the bundled PSX snapshots (see sampleKSE100.ts / sampleKMI30.ts). */
export const BUNDLED_SNAPSHOT_DATE = '2026-11-17T10:30:00+05:00';

export const INDEX_META: Record<IndexKey, IndexMeta> = {
  KSE100: {
    key: 'KSE100',
    label: 'KSE-100',
    slug: 'KSE100',
    description: '100 companies · weights normalised to 100%',
    minConstituents: 20,
    psxUrl: 'https://dps.psx.com.pk/indices/KSE100',
    bundledSourceLabel: 'PSX Data Portal — bundled KSE-100 snapshot',
  },
  KMI30: {
    key: 'KMI30',
    label: 'KMI-30',
    slug: 'KMI30',
    description: '30 Shariah-compliant companies · normalised to 100%',
    minConstituents: 15,
    psxUrl: 'https://dps.psx.com.pk/indices/KMI30',
    bundledSourceLabel: 'PSX Data Portal — bundled KMI-30 snapshot',
  },
};

export const INDEX_KEYS: readonly IndexKey[] = ['KSE100', 'KMI30'];

export function isIndexKey(value: unknown): value is IndexKey {
  return value === 'KSE100' || value === 'KMI30';
}

export function getIndexMeta(index: IndexKey): IndexMeta {
  return INDEX_META[index];
}
