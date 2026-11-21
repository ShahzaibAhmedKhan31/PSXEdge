import { describe, expect, it } from 'vitest';
import { PRICE_SNAPSHOT, SAMPLE_PRICES } from './priceSnapshot';
import { SAMPLE_KMI30 } from './sampleKMI30';
import { SAMPLE_KSE100 } from './sampleKSE100';

describe('bundled price snapshot', () => {
  it('prices every bundled KSE-100 and KMI-30 constituent', () => {
    for (const constituent of SAMPLE_KSE100) {
      expect(SAMPLE_PRICES.KSE100[constituent.ticker], `${constituent.ticker} price`).toBeGreaterThan(0);
    }
    for (const constituent of SAMPLE_KMI30) {
      expect(SAMPLE_PRICES.KMI30[constituent.ticker], `${constituent.ticker} price`).toBeGreaterThan(0);
    }
    expect(Object.keys(SAMPLE_PRICES.KSE100)).toHaveLength(100);
    expect(Object.keys(SAMPLE_PRICES.KMI30)).toHaveLength(30);
  });

  it('holds plausible, finite rupee prices', () => {
    for (const price of Object.values(SAMPLE_PRICES.KSE100)) {
      expect(Number.isFinite(price)).toBe(true);
      expect(price).toBeGreaterThan(0);
      expect(price).toBeLessThan(100_000);
    }
  });

  it("matches PSX's FFC quote used in the share example", () => {
    expect(SAMPLE_PRICES.KSE100.FFC).toBe(571.3);
    expect(SAMPLE_PRICES.KMI30.FFC).toBe(571.3);
    expect(SAMPLE_PRICES.KSE100.NESTLE).toBe(7020.51);
    expect(SAMPLE_PRICES.KSE100.UPFL).toBe(26355);
  });

  it('is clearly labelled as a dated snapshot, not live data', () => {
    expect(PRICE_SNAPSHOT.label).toContain('PSX');
    expect(Number.isNaN(Date.parse(PRICE_SNAPSHOT.capturedAt))).toBe(false);
    expect(PRICE_SNAPSHOT.sourceUrl).toContain('dps.psx.com.pk');
  });
});
