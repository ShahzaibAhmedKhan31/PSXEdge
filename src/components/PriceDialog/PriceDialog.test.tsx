import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { INDEX_META } from '../../data/indexMeta';
import { SAMPLE_KSE100 } from '../../data/sampleKSE100';
import { snapshotPriceSet } from '../../services/priceService';
import { PriceDialog } from './PriceDialog';

const tickers = SAMPLE_KSE100.map((company) => company.ticker);

function render(open: boolean) {
  return renderToString(
    createElement(PriceDialog, {
      open,
      index: 'KSE100',
      meta: INDEX_META.KSE100,
      priceSet: snapshotPriceSet('KSE100'),
      tickers,
      onApply: () => {},
      onReset: () => {},
      onClose: () => {},
    }),
  );
}

describe('PriceDialog', () => {
  it('renders nothing while closed', () => {
    expect(render(false)).toBe('');
  });

  it('prefills a TICKER,PRICE line for every constituent', () => {
    const html = render(true);
    expect(html).toContain('Share prices');
    expect(html).toContain('FFC,571.30');
    expect(html).toContain('Apply prices');
    expect(html).toContain('Reset to snapshot');
    expect(html).toContain('PSX Data Portal');
  });
});
