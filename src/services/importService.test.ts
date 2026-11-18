import { describe, expect, it } from 'vitest';
import { INDEX_META } from '../data/indexMeta';
import { analyzeFile, datasetFromImport, readSpreadsheetFile } from './importService';

const rows: [string, string, string, number][] = Array.from({ length: 22 }, (_, index) => [
  `C${String(index + 1).padStart(2, '0')}`,
  `Imported Company ${index + 1} Limited`,
  index % 2 === 0 ? 'Cement' : 'Fertilizer',
  Number((11 - index * 0.4).toFixed(2)),
]);

async function buildXlsxFile(): Promise<File> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Constituents');
  sheet.addRow(['Ticker', 'Company Name', 'Sector', 'Weightage']);
  rows.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([buffer], 'psx-constituents.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('readSpreadsheetFile', () => {
  it('reads an XLSX workbook in the browser layer', async () => {
    const file = await buildXlsxFile();
    const parsed = await readSpreadsheetFile(file);
    expect(parsed.fileName).toBe('psx-constituents.xlsx');
    expect(parsed.rows).toHaveLength(23);
    expect(parsed.rows[0]).toEqual(['Ticker', 'Company Name', 'Sector', 'Weightage']);
    expect(parsed.rows[1][0]).toBe('C01');
  });

  it('reads CSV text', async () => {
    const csv = 'Ticker,Company Name,Sector,Weightage\nFFC,Fauji Fertilizer,Fertilizer,9.13\nUBL,United Bank,Commercial Banks,7.75';
    const parsed = await readSpreadsheetFile(new File([csv], 'constituents.csv', { type: 'text/csv' }));
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[1]).toEqual(['FFC', 'Fauji Fertilizer', 'Fertilizer', '9.13']);
  });

  it('rejects unsupported and legacy formats', async () => {
    await expect(readSpreadsheetFile(new File(['x'], 'data.pdf'))).rejects.toThrow(/Unsupported file type/);
    await expect(readSpreadsheetFile(new File(['x'], 'data.xls'))).rejects.toThrow(/Legacy .xls/);
  });

  it('rejects oversized files', async () => {
    const big = new File([new Uint8Array(9 * 1024 * 1024)], 'big.csv');
    await expect(readSpreadsheetFile(big)).rejects.toThrow(/larger than 8 MB/);
  });
});

describe('analyseFile + datasetFromImport', () => {
  it('validates an uploaded file and builds a persistable dataset', async () => {
    const parsed = await readSpreadsheetFile(await buildXlsxFile());
    const analysis = analyzeFile(parsed, INDEX_META.KSE100);
    expect(analysis.ok).toBe(true);
    expect(analysis.all).toHaveLength(22);
    expect(analysis.all[0].ticker).toBe('C01');
    expect(analysis.all[19].ticker).toBe('C20');

    const dataset = datasetFromImport({ index: 'KSE100', analysis, fileName: parsed.fileName });
    expect(dataset.origin).toBe('imported');
    expect(dataset.index).toBe('KSE100');
    expect(dataset.constituents).toHaveLength(22);
    expect(dataset.importedFrom).toBe('psx-constituents.xlsx');
    expect(dataset.sourceLabel).toContain('psx-constituents.xlsx');
    expect(Number.isNaN(Date.parse(dataset.retrievedAt))).toBe(false);
  });

  it('keeps every company when importing the same file for KMI-30', async () => {
    const parsed = await readSpreadsheetFile(await buildXlsxFile());
    const analysis = analyzeFile(parsed, INDEX_META.KMI30);
    expect(analysis.ok).toBe(true);
    expect(analysis.all).toHaveLength(22);
  });
});
