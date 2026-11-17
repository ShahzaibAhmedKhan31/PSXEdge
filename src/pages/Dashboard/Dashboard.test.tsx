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
    expect(html).toContain('FFC');
    expect(html).toContain('Rs 100,000');
    // Default KSE-100 plan is over-allocated by design (69.74% × 1.5).
    expect(html).toContain('Over-allocated by');
    expect(html).toContain('Bundled snapshot');
  });
});
