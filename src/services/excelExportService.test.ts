import { describe, expect, it } from 'vitest';
import { INDEX_META } from '../data/indexMeta';
import { SAMPLE_KMI30 } from '../data/sampleKMI30';
import { SAMPLE_KSE100 } from '../data/sampleKSE100';
import { computeBreakdown } from './investmentCalculator';
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
const breakdown = computeBreakdown(dataset.constituents, 1_000_000, meta.defaultMultiplier, meta.topN);
const generatedAt = new Date('2026-11-17T12:00:00Z');

describe('Excel export', () => {
  it('creates the documented file name', () => {
    expect(buildFileName(meta, generatedAt)).toBe('PSXEdge_KMI30_Investment_Breakdown_2026-11-17.xlsx');
  });

  it('creates two worksheets with the expected names', async () => {
    const workbook = await createInvestmentWorkbook({ meta, dataset, breakdown, generatedAt });
    expect(workbook.worksheets).toHaveLength(2);
    expect(workbook.worksheets[0].name).toBe('Investment Summary');
    expect(workbook.worksheets[1].name).toBe('Company Breakdown');
  });

  it('writes the summary values that are on screen', async () => {
    const workbook = await createInvestmentWorkbook({ meta, dataset, breakdown, generatedAt });
    const summary = workbook.getWorksheet('Investment Summary');
    const valueFor = (label: string) => {
      let found: unknown;
      summary?.eachRow((row) => {
        if (String(row.getCell(1).value ?? '') === label) found = row.getCell(2).value;
      });
      return found;
    };

    expect(valueFor('Application')).toBe('PSXEdge');
    expect(valueFor('Selected Index')).toBe('KMI-30');
    expect(valueFor('Companies Included')).toBe(15);
    expect(valueFor('Investment Amount (PKR)')).toBe(1_000_000);
    expect(valueFor('Applied Multiplier')).toBe(1.1);
    expect(Number(valueFor('Total Adjusted Weightage'))).toBeCloseTo(99.946, 3);
    expect(valueFor('Total Allocated Amount (PKR)')).toBe(breakdown.totals.allocatedAmount);
    expect(valueFor('Remaining Cash (PKR)')).toBe(breakdown.totals.remainingCash);
    expect(valueFor('Allocation Status')).toBe('Within budget');
  });

  it('writes exactly 15 company rows plus totals with correct formatting', async () => {
    const workbook = await createInvestmentWorkbook({ meta, dataset, breakdown, generatedAt });
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

    expect(sheet.getRow(2).getCell(2).value).toBe('FFC');
    expect(sheet.getRow(2).getCell(5).value).toBe(12.33);
    expect(sheet.getRow(2).getCell(5).numFmt).toBe('0.00"%"');
    expect(sheet.getRow(2).getCell(8).numFmt).toBe('"Rs" #,##0');
    expect(sheet.getRow(2).getCell(8).value).toBe(breakdown.rows[0].allocationRounded);
    expect(sheet.getRow(16).getCell(2).value).toBe(breakdown.rows[14].ticker);

    // Header is frozen and filters cover the data range only.
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(sheet.autoFilter).toMatchObject({ from: { row: 1, column: 1 }, to: { row: 16, column: 8 } });

    // Totals row (17) matches the on-screen totals.
    expect(sheet.getRow(17).getCell(1).value).toBe('Total');
    expect(sheet.getRow(17).getCell(7).value).toBeCloseTo(breakdown.totals.adjustedWeightage, 4);
    expect(sheet.getRow(17).getCell(8).value).toBe(breakdown.totals.allocatedAmount);
  });

  it('round-trips through xlsx serialisation', async () => {
    const workbook = await createInvestmentWorkbook({ meta, dataset, breakdown, generatedAt });
    const buffer = await workbook.xlsx.writeBuffer();
    expect(buffer.byteLength).toBeGreaterThan(1000);

    const ExcelJS = await import('exceljs');
    const reloaded = new ExcelJS.Workbook();
    await reloaded.xlsx.load(buffer);
    const sheet = reloaded.getWorksheet('Company Breakdown');
    expect(sheet?.rowCount).toBeGreaterThanOrEqual(17);
    expect(sheet?.getRow(2).getCell(2).value).toBe('FFC');
  });

  it('works for KSE-100 with 20 companies', async () => {
    const kseBreakdown = computeBreakdown(SAMPLE_KSE100, 500_000, 1.5, 20);
    const workbook = await createInvestmentWorkbook({
      meta: INDEX_META.KSE100,
      dataset: { ...dataset, index: 'KSE100', constituents: [...SAMPLE_KSE100] },
      breakdown: kseBreakdown,
      generatedAt,
    });
    const sheet = workbook.getWorksheet('Company Breakdown');
    expect(sheet?.getRow(21).getCell(2).value).toBe(kseBreakdown.rows[19].ticker);
    expect(sheet?.getRow(22).getCell(1).value).toBe('Total');
    expect(workbook.getWorksheet('Investment Summary')?.getCell('B6').value).toBe('KSE-100');
  });
});
