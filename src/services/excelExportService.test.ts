import { describe, expect, it } from 'vitest';
import { INDEX_META } from '../data/indexMeta';
import { SAMPLE_KMI30 } from '../data/sampleKMI30';
import { SAMPLE_KSE100 } from '../data/sampleKSE100';
import { computeNormalisedBreakdown, rankConstituents } from './investmentCalculator';
import { buildFileName, createInvestmentWorkbook } from './excelExportService';
import type { IndexDataset } from '../types';

const dataset: IndexDataset = {
  index: 'KMI30',
  constituents: [...SAMPLE_KMI30],
  origin: 'bundled',
  sourceLabel: 'PSX Data Portal — bundled KMI-30 snapshot',
  sourceUrl: 'https://dps.psx.com.pk/indices/KMI30',
  retrievedAt: '2026-11-17T10:30:00+05:00',
};

const meta = INDEX_META.KMI30;
const breakdown = computeNormalisedBreakdown(rankConstituents(dataset.constituents), 1_000_000);
const generatedAt = new Date('2026-11-17T12:00:00Z');

const exportParams = {
  meta,
  dataset,
  breakdown,
  filterSummary: 'All 30 companies',
  totalConstituents: 30,
  generatedAt,
};

function summaryReader(workbook: Awaited<ReturnType<typeof createInvestmentWorkbook>>) {
  const summary = workbook.getWorksheet('Investment Summary');
  return (label: string) => {
    let found: unknown;
    summary?.eachRow((row) => {
      if (String(row.getCell(1).value ?? '') === label) found = row.getCell(2).value;
    });
    return found;
  };
}

describe('Excel export', () => {
  it('creates the documented file name', () => {
    expect(buildFileName(meta, generatedAt)).toBe('PSXEdge_KMI30_Investment_Breakdown_2026-11-17.xlsx');
  });

  it('creates two worksheets with the expected names', async () => {
    const workbook = await createInvestmentWorkbook(exportParams);
    expect(workbook.worksheets).toHaveLength(2);
    expect(workbook.worksheets[0].name).toBe('Investment Summary');
    expect(workbook.worksheets[1].name).toBe('Company Breakdown');
  });

  it('writes the summary values that are on screen', async () => {
    const workbook = await createInvestmentWorkbook(exportParams);
    const valueFor = summaryReader(workbook);

    expect(valueFor('Application')).toBe('PSXEdge');
    expect(valueFor('Selected Index')).toBe('KMI-30');
    expect(valueFor('Selection')).toBe('All 30 companies');
    expect(valueFor('Weighting Method')).toBe('Auto-normalised — adjusted weights total 100%');
    expect(valueFor('Constituents Included')).toBe('30 of 30');
    expect(valueFor('Investment Amount (PKR)')).toBe(1_000_000);
    expect(valueFor('Applied Multiplier (auto-derived)')).toBeCloseTo(breakdown.totals.multiplier, 10);
    expect(valueFor('Total Adjusted Weightage')).toBe(100);
    expect(valueFor('Total Allocated Amount (PKR)')).toBe(1_000_000);
    expect(valueFor('Remaining Cash (PKR)')).toBe(0);
    expect(valueFor('Allocation Status')).toBe('Fully allocated within budget');
  });

  it('writes every company row plus totals with correct formatting', async () => {
    const workbook = await createInvestmentWorkbook(exportParams);
    const sheet = workbook.getWorksheet('Company Breakdown');
    expect(sheet).toBeDefined();
    if (!sheet) return;

    const headers = (sheet.getRow(1).values as unknown[]).slice(1);
    expect(headers).toEqual([
      'Rank',
      'Ticker',
      'Company Name',
      'Sector',
      'Original Index Weightage (%)',
      'Multiplier',
      'Adjusted Weightage (%)',
      'Investment Amount (PKR)',
    ]);

    expect(sheet.rowCount).toBeGreaterThanOrEqual(34);
    expect(sheet.getRow(2).getCell(2).value).toBe('FFC');
    expect(sheet.getRow(2).getCell(5).value).toBe(12.33);
    expect(sheet.getRow(2).getCell(6).value).toBeCloseTo(breakdown.totals.multiplier, 10);
    expect(sheet.getRow(2).getCell(7).value).toBeCloseTo(breakdown.rows[0].adjustedWeightage, 4);
    expect(sheet.getRow(2).getCell(5).numFmt).toBe('0.00"%"');
    expect(sheet.getRow(2).getCell(8).numFmt).toBe('"Rs" #,##0');
    expect(sheet.getRow(2).getCell(8).value).toBe(breakdown.rows[0].allocationRounded);
    expect(sheet.getRow(31).getCell(2).value).toBe(breakdown.rows[29].ticker);

    // Header is frozen and filters cover the data range only.
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(sheet.autoFilter).toMatchObject({ from: { row: 1, column: 1 }, to: { row: 31, column: 8 } });

    // Totals row (32) matches the on-screen totals.
    expect(sheet.getRow(32).getCell(1).value).toBe('Total');
    expect(sheet.getRow(32).getCell(3).value).toBe('30 of 30 companies');
    expect(sheet.getRow(32).getCell(7).value).toBe(100);
    expect(sheet.getRow(32).getCell(8).value).toBe(1_000_000);
  });

  it('round-trips through xlsx serialisation', async () => {
    const workbook = await createInvestmentWorkbook(exportParams);
    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);

    const ExcelJS = await import('exceljs');
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buffer);
    const sheet = reloaded.getWorksheet('Company Breakdown');
    expect(sheet?.rowCount).toBeGreaterThanOrEqual(32);
    expect(sheet?.getRow(2).getCell(2).value).toBe('FFC');
  });

  it('exports the full 100-name KSE-100 list', async () => {
    const kseBreakdown = computeNormalisedBreakdown(rankConstituents(SAMPLE_KSE100), 500_000);
    const workbook = await createInvestmentWorkbook({
      meta: INDEX_META.KSE100,
      dataset: { ...dataset, index: 'KSE100', constituents: [...SAMPLE_KSE100] },
      breakdown: kseBreakdown,
      filterSummary: 'Top 20 of 100 by weightage · sector: Commercial Banks',
      totalConstituents: 100,
      excludedCompanies: ['FFC', 'UBL'],
      generatedAt,
    });
    const sheet = workbook.getWorksheet('Company Breakdown');
    expect(sheet?.getRow(101).getCell(2).value).toBe(kseBreakdown.rows[99].ticker);
    expect(sheet?.getRow(102).getCell(1).value).toBe('Total');

    const valueFor = summaryReader(workbook);
    expect(valueFor('Selected Index')).toBe('KSE-100');
    expect(valueFor('Selection')).toBe('Top 20 of 100 by weightage · sector: Commercial Banks');
    expect(valueFor('Constituents Included')).toBe('100 of 100');
    expect(valueFor('Unchecked Companies')).toBe('FFC, UBL');
  });
});
