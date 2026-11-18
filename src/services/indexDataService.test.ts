import { afterEach, describe, expect, it, vi } from 'vitest';
import { INDEX_META } from '../data/indexMeta';
import {
  classifyFetchError,
  constituentsFromTable,
  proxyPathFor,
  refreshIndexData,
} from './indexDataService';

const feedRows = Array.from({ length: 20 }, (_, index) => ({
  ticker: `F${String(index + 1).padStart(2, '0')}`,
  companyName: `Feed Company ${index + 1}`,
  sector: 'Cement',
  weightage: Number((12 - index * 0.4).toFixed(2)),
}));

const PSX_HEADERS = ['SYMBOL', 'NAME', 'LDCP', 'CURRENT', 'CHANGE', 'CHANGE (%)', 'IDX WTG (%)', 'VOLUME'];
const PSX_ROWS = Array.from({ length: 20 }, (_, index) => [
  `${index === 0 ? 'FFC XD' : `P${String(index + 1).padStart(2, '0')}`}`,
  index === 0 ? 'Fauji Fertilizer Company Limited' : `Proxy Company ${index + 1}`,
  '100.00',
  '101.00',
  '1.00',
  '1.00%',
  `${(12 - index * 0.4).toFixed(2)}%`,
  '1000',
]);

/** Minimal DOMParser stand-in so the HTML adapter can be exercised in Node. */
function installFakeDom(tables: string[][][]) {
  const makeCell = (text: string) => ({ textContent: text });
  const makeRow = (cells: string[]) => ({ querySelectorAll: () => cells.map(makeCell) });
  const makeTable = (rows: string[][]) => ({ querySelectorAll: () => rows.map(makeRow) });
  vi.stubGlobal(
    'DOMParser',
    class {
      parseFromString() {
        return { querySelectorAll: () => tables.map(makeTable) };
      }
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('constituentsFromTable', () => {
  it('reads PSX-style rows, strips XD and enriches sectors', () => {
    const parsed = constituentsFromTable({ headers: PSX_HEADERS, rows: PSX_ROWS });
    expect(parsed).toHaveLength(20);
    expect(parsed[0]).toMatchObject({
      ticker: 'FFC',
      companyName: 'Fauji Fertilizer Company Limited',
      sector: 'Fertilizer',
      weightage: 12,
    });
    expect(parsed[1].ticker).toBe('P02');
  });

  it('skips invalid weights and rows without a ticker', () => {
    const parsed = constituentsFromTable({
      headers: PSX_HEADERS,
      rows: [
        ['', 'No ticker', '1', '1', '1', '1%', '5.00%', '1'],
        ['AAA', 'Bad weight', '1', '1', '1', '1%', 'n/a', '1'],
        ['BBB', 'Over 100', '1', '1', '1', '1%', '150%', '1'],
        ['CCC', 'Fine', '1', '1', '1', '1%', '4.5%', '1'],
      ],
    });
    expect(parsed.map((row) => row.ticker)).toEqual(['CCC']);
  });

  it('returns nothing when the weight column is absent', () => {
    expect(constituentsFromTable({ headers: ['SYMBOL', 'NAME'], rows: [['FFC', 'Fauji']] })).toEqual([]);
  });

  it('maps PSX URLs onto the proxy path', () => {
    expect(proxyPathFor(INDEX_META.KSE100)).toBe('/psx/indices/KSE100');
    expect(proxyPathFor(INDEX_META.KMI30)).toBe('/psx/indices/KMI30');
  });
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
  it('uses the same-origin proxy first and keeps the data live', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '<html></html>' });
    vi.stubGlobal('fetch', fetchMock);
    installFakeDom([[PSX_HEADERS, ...PSX_ROWS]]);

    const outcome = await refreshIndexData('KSE100', '');
    expect(outcome.corsBlocked).toBe(false);
    expect(outcome.dataset?.origin).toBe('live');
    expect(outcome.dataset?.constituents).toHaveLength(20);
    expect(outcome.dataset?.sourceLabel).toMatch(/proxy/i);
    expect(outcome.attempts).toHaveLength(1);
    expect(outcome.attempts[0]).toMatchObject({ ok: true, label: 'PSX proxy (/psx/indices/KSE100)' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/psx/indices/KSE100', expect.anything());
  });

  it('falls back to a direct request and flags CORS when the proxy is missing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await refreshIndexData('KMI30', '');
    expect(outcome.dataset).toBeNull();
    expect(outcome.corsBlocked).toBe(true);
    expect(outcome.attempts).toHaveLength(2);
    expect(outcome.attempts[0]).toMatchObject({ ok: false, corsBlocked: false });
    expect(outcome.attempts[0].label).toContain('/psx/indices/KMI30');
    expect(outcome.attempts[0].message).toMatch(/404/);
    expect(outcome.attempts[1].corsBlocked).toBe(true);
    expect(outcome.attempts[1].label).toContain(INDEX_META.KMI30.psxUrl.replace('https://', ''));
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await refreshIndexData('KSE100', 'https://feeds.example.com/thin.json');
    expect(outcome.dataset).toBeNull();
    expect(outcome.corsBlocked).toBe(true);
    expect(outcome.attempts).toHaveLength(3);
    expect(outcome.attempts[0].ok).toBe(false);
    expect(outcome.attempts[0].message).toMatch(/needs at least 20/);
    expect(outcome.attempts[1].label).toContain('/psx/indices/KSE100');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
