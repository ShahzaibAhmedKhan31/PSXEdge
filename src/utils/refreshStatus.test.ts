import { describe, expect, it } from 'vitest';
import { analyseRefreshAttempts, attemptIndex } from './refreshStatus';

const attempt = (label: string, ok: boolean, corsBlocked = false): { label: string; ok: boolean; corsBlocked: boolean; message?: string } => ({
  label,
  ok,
  corsBlocked,
  message: ok ? undefined : 'failed.',
});

describe('attemptIndex', () => {
  it('parses the index from a "KSE-100 · …" label', () => {
    expect(attemptIndex('KSE-100 · Custom feed (feeds.example.com)')).toBe('KSE100');
    expect(attemptIndex('KMI-30 · PSX proxy (/psx/indices/KMI30)')).toBe('KMI30');
    expect(attemptIndex('Unknown index · something')).toBeNull();
  });
});

describe('analyseRefreshAttempts', () => {
  it('reports success when the optional feed fails but the proxy succeeds', () => {
    const attempts = [
      attempt('KSE-100 · Custom feed (feeds.example.com)', false, false),
      attempt('KSE-100 · PSX proxy (/psx/indices/KSE100)', true, false),
      attempt('KMI-30 · PSX proxy (/psx/indices/KMI30)', true, false),
    ];

    const status = analyseRefreshAttempts(attempts);

    expect(status.succeeded).toEqual(['KSE100', 'KMI30']);
    expect(status.failed).toEqual([]);
    expect(status.corsBlocked).toBe(false);
    expect(status.ignoredFailures).toHaveLength(1);
    expect(status.ignoredFailures[0].label).toContain('Custom feed');
    expect(status.blockingFailures).toEqual([]);
  });

  it('treats a PSX URL saved as a custom feed as an ignored, non-CORS failure', () => {
    const attempts = [
      attempt('KSE-100 · Custom feed (dps.psx.com.pk)', false, false),
      attempt('KSE-100 · PSX proxy (/psx/indices/KSE100)', true, false),
    ];

    const status = analyseRefreshAttempts(attempts);

    expect(status.succeeded).toEqual(['KSE100']);
    expect(status.corsBlocked).toBe(false);
    expect(status.ignoredFailures).toHaveLength(1);
    expect(status.blockingFailures).toEqual([]);
  });

  it('reports only success when every source succeeds', () => {
    const attempts = [
      attempt('KSE-100 · PSX proxy (/psx/indices/KSE100)', true, false),
      attempt('KMI-30 · PSX proxy (/psx/indices/KMI30)', true, false),
    ];

    const status = analyseRefreshAttempts(attempts);

    expect(status.succeeded).toEqual(['KSE100', 'KMI30']);
    expect(status.failed).toEqual([]);
    expect(status.corsBlocked).toBe(false);
    expect(status.ignoredFailures).toEqual([]);
    expect(status.blockingFailures).toEqual([]);
  });

  it('flags a real block only when every source fails and one is CORS-typed', () => {
    const attempts = [
      attempt('KSE-100 · Custom feed (feeds.example.com)', false, true),
      attempt('KSE-100 · PSX proxy (/psx/indices/KSE100)', false, false),
      attempt('KMI-30 · PSX proxy (/psx/indices/KMI30)', false, false),
    ];

    const status = analyseRefreshAttempts(attempts);

    expect(status.succeeded).toEqual([]);
    expect(status.failed).toEqual(['KSE100', 'KMI30']);
    expect(status.corsBlocked).toBe(true);
    expect(status.blockingFailures).toHaveLength(3);
  });

  it('keeps corsBlocked false when every source fails but none are CORS-typed', () => {
    const attempts = [
      attempt('KSE-100 · PSX proxy (/psx/indices/KSE100)', false, false),
      attempt('KMI-30 · PSX proxy (/psx/indices/KMI30)', false, false),
    ];

    const status = analyseRefreshAttempts(attempts);

    expect(status.corsBlocked).toBe(false);
    expect(status.failed).toEqual(['KSE100', 'KMI30']);
    expect(status.blockingFailures).toHaveLength(2);
  });

  it('marks an index failed when only its sources fail, while the other succeeds', () => {
    const attempts = [
      attempt('KSE-100 · PSX proxy (/psx/indices/KSE100)', true, false),
      attempt('KMI-30 · PSX proxy (/psx/indices/KMI30)', false, false),
    ];

    const status = analyseRefreshAttempts(attempts);

    expect(status.succeeded).toEqual(['KSE100']);
    expect(status.failed).toEqual(['KMI30']);
    expect(status.corsBlocked).toBe(false);
    expect(status.blockingFailures).toHaveLength(1);
    expect(status.blockingFailures[0].label).toContain('KMI-30');
  });

  it('ignores attempts that cannot be tied to a known index', () => {
    const attempts = [
      attempt('KSE-100 · PSX proxy (/psx/indices/KSE100)', true, false),
      attempt('Something unrelated · noise', false, true),
    ];

    const status = analyseRefreshAttempts(attempts);

    expect(status.succeeded).toEqual(['KSE100']);
    expect(status.corsBlocked).toBe(false);
    expect(status.blockingFailures).toEqual([]);
  });
});
