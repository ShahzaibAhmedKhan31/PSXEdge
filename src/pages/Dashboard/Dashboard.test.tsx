import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Dashboard } from './Dashboard';

/**
 * Server-render smoke test: the whole dashboard must render with no browser
 * APIs available, no dataset cached, and no network access.
 */
describe('Dashboard render', () => {
  it('renders the default KSE-100 view', () => {
    const html = renderToString(createElement(Dashboard));

    expect(html).toContain('PSXEdge');
    expect(html).toContain('Smarter Allocation. Simpler Investing.');
    expect(html).toContain('KSE-100');
    expect(html).toContain('KMI-30');
    expect(html).toContain('Total investment amount');
    expect(html).toContain('Weighting multiplier');
    expect(html).toContain('Allocation breakdown');
    expect(html).toContain('Original weight');
    expect(html).toContain('Investment (PKR)');
    expect(html).toContain('Price / share (Rs)');
    expect(html).toContain('Shares to buy');
    expect(html).toContain('Update prices');
    expect(html).toContain('Current price for FFC in rupees');
    expect(html).toContain('Invested amount');
    expect(html).toContain('Uninvested cash');
    expect(html).toContain('FFC');
    expect(html).toContain('Rs 100,000');
    // The full index is listed: a small-cap name near rank 100 must be present.
    expect(html).toContain('PGLC');
    // The multiplier is derived and read-only, normalising the visible list to 100%.
    expect(html).toContain('Automatic');
    expect(html).toContain('100.00%');
    // Shortlist + drill-down controls are rendered.
    expect(html).toContain('Top 20');
    expect(html).toContain('All sectors');
    expect(html).toContain('Search company or ticker');
    // The Excel-style company checklist is mounted (its panel opens on click).
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('Bundled snapshot');
  });
});
