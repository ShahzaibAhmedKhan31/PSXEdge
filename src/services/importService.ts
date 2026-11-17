import type { IndexDataset, IndexKey, IndexMeta } from '../types';
import { parseDelimited } from '../utils/csvParser';
import { analyzeTable, type ImportAnalysis } from '../utils/dataValidator';
import { createBundledDataset } from './indexDataService';

export const MAX_IMPORT_BYTES = 8 * 1024 * 1024; // 8 MB

type ExcelJSModule = typeof import('exceljs');

/** Turn any ExcelJS cell value into plain text. */
function cellValueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.richText)) {
      return (record.richText as { text?: string }[]).map((part) => part.text ?? '').join('').trim();
    }
    if ('result' in record) return cellValueToString(record.result);
    if ('text' in record) return cellValueToString(record.text);
  }
  return '';
}

async function readWorkbookRows(file: File): Promise<string[][]> {
  const { default: ExcelJS } = (await import('exceljs')) as unknown as { default: ExcelJSModule };
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('The workbook does not contain any worksheets.');

  const rows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    const cells: string[] = [];
    // ExcelJS rows are 1-indexed; index 0 is always empty.
    for (let column = 1; column < values.length; column += 1) {
      cells.push(cellValueToString(values[column]));
    }
    if (cells.some((cell) => cell !== '')) rows.push(cells);
  });
  return rows;
}

export interface ParsedFile {
  rows: string[][];
  fileName: string;
  sheetNote: string;
}

/** Read a CSV/TSV/XLSX file entirely in the browser. */
export async function readSpreadsheetFile(file: File): Promise<ParsedFile> {
  if (file.size > MAX_IMPORT_BYTES) {
    throw new Error('File is larger than 8 MB. Please import a smaller dataset.');
  }

  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xlsm')) {
    const rows = await readWorkbookRows(file);
    return { rows, fileName: file.name, sheetNote: 'First worksheet' };
  }

  if (lowerName.endsWith('.xls')) {
    throw new Error('Legacy .xls files are not supported. Save the file as .xlsx or .csv and try again.');
  }

  if (lowerName.endsWith('.csv') || lowerName.endsWith('.tsv') || lowerName.endsWith('.txt')) {
    const text = await file.text();
    return { rows: parseDelimited(text), fileName: file.name, sheetNote: 'CSV text' };
  }

  throw new Error('Unsupported file type. Upload a .csv, .tsv or .xlsx file.');
}

export function analyzeFile(parsed: ParsedFile, meta: IndexMeta): ImportAnalysis {
  return analyzeTable(parsed.rows, meta);
}

/** Build the dataset that will be persisted after a successful import. */
export function datasetFromImport(params: {
  index: IndexKey;
  analysis: ImportAnalysis;
  fileName: string;
}): IndexDataset {
  return {
    index: params.index,
    constituents: params.analysis.all,
    origin: 'imported',
    sourceLabel: `Imported file — ${params.fileName}`,
    retrievedAt: new Date().toISOString(),
    importedFrom: params.fileName,
  };
}

/** A ready-to-fill CSV template seeded with the current snapshot for the index. */
export function downloadCsvTemplate(index: IndexKey): string {
  const dataset = createBundledDataset(index);
  const lines = ['Ticker,Company Name,Sector,Weightage'];
  for (const company of dataset.constituents) {
    const name = company.companyName.includes(',') ? `"${company.companyName}"` : company.companyName;
    const sector = company.sector.includes(',') ? `"${company.sector}"` : company.sector;
    lines.push(`${company.ticker},${name},${sector},${company.weightage.toFixed(2)}`);
  }

  const fileName = `PSXEdge_${index}_Import_Template.csv`;
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return fileName;
}
