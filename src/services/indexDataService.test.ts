import { afterEach, describe, expect, it, vi } from 'vitest';
import { INDEX_META } from '../data/indexMeta';
import { classifyFetchError, refreshIndexData } from './indexDataService';

const feedRows = Array.from({ length: 20 }, (_, index) => ({
  ticker: `F${String(index + 1).padStart(2, '0')}`,
  companyName: `Feed Company ${index + 1}`,
  sector: 'Cement',
  weightage: Number((12 - index * 0.4).toFixed(2)),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('classifyFetchError', () => {
  it('treats a fetch TypeError as a CORS block', () => {
    const info = classifyFetchError(new TypeError('Failed to fetch'));
    expect(info.corsBlocked).toBe(true);
    expect(info.message).toMatch(/CORS/);
    expect(info.message).toMatch(/Access-Control-Allow-Origin/);
  });

  it('reports timeouts separately', () => {
    const info = classifyFetchError(new DOMException('The operation was aborted.', 'AbortError'));
    expect(info.corsBlocked).toBe(false);
    expect(info.message).toMatch(/timed out/);
  });

  it('passes through other error messages', () => {
    const info = classifyFetchError(new Error('PSX responded with HTTP 503.'));
    expect(info.corsBlocked).toBe(false);
    expect(info.message).toBe('PSX responded with HTTP 503.');
  });
});

describe('refreshIndexData', () => {
  it('falls back gracefully and flags CORS when the browser blocks PSX', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await refreshIndexData('KMI30', '');
    expect(outcome.dataset).toBeNull();
    expect(outcome.corsBlocked).toBe(true);
    expect(outcome.attempts).toHaveLength(1);
    expect(outcome.attempts[0].corsBlocked).toBe(true);
    expect(outcome.attempts[0].label).toContain(INDEX_META.KMI30.psxUrl.replace('https://', ''));
    // Only one network request is made per refresh.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses a CORS-enabled feed when one is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ constituents: feedRows }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await refreshIndexData('KSE100', 'https://feeds.example.com/psx-kse100.json');
    expect(outcome.corsBlocked).toBe(false);
    expect(outcome.dataset).not.toBeNull();
    expect(outcome.dataset?.origin).toBe('live');
    expect(outcome.dataset?.constituents).toHaveLength(20);
    expect(outcome.dataset?.sourceLabel).toContain('feeds.example.com');
    expect(outcome.attempts[0].ok).toBe(true);
    // PSX is never contacted when the feed succeeds.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects feed data that cannot satisfy the top-N requirement, then tries PSX', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ constituents: feedRows.slice(0, 5) }) })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await refreshIndexData('KSE100', 'https://feeds.example.com/thin.json');
    expect(outcome.dataset).toBeNull();
    expect(outcome.corsBlocked).toBe(true);
    expect(outcome.attempts).toHaveLength(2);
    expect(outcome.attempts[0].ok).toBe(false);
    expect(outcome.attempts[0].message).toMatch(/needs at least 20/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
