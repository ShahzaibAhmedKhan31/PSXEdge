import type { IndexDataset, IndexMeta } from '../types';
import type { InvestmentBreakdown } from '../types/investment';
import { formatPKRAmount } from '../utils/currencyFormatter';

/** Lazily-loaded ExcelJS module namespace. */
type ExcelJSModule = typeof import('exceljs');

let excelJsPromise: Promise<ExcelJSModule> | null = null;

/**
 * ExcelJS is ~1 MB, so it is only downloaded when the user actually exports.
 */
async function loadExcelJS(): Promise<ExcelJSModule> {
  if (!excelJsPromise) {
    excelJsPromise = import('exceljs').then((module) => {
      const namespace = module as unknown as ExcelJSModule & { default?: ExcelJSModule };
      // Vite's CJS interop can expose the library either as the default export
      // or as named exports depending on the build, so support both shapes.
      if (typeof namespace.Workbook === 'function') return namespace;
      if (namespace.default && typeof namespace.default.Workbook === 'function') return namespace.default;
      throw new Error('ExcelJS could not be loaded in this browser.');
    });
  }
  return excelJsPromise;
}

const CURRENCY_FORMAT = '"Rs" #,##0';
const PERCENT_FORMAT = '0.00"%"';

const COLORS = {
  brand: 'FF047857',
  brandDark: 'FF064E3B',
  header: 'FF111827',
  section: 'FFF1F5F9',
  border: 'FFD9DEE5',
  zebra: 'FFF8FAFC',
  white: 'FFFFFFFF',
  negative: 'FFB91C1C',
  muted: 'FF6B7280',
} as const;

export interface ExportParams {
  meta: IndexMeta;
  dataset: IndexDataset;
  breakdown: InvestmentBreakdown;
  /** Human-readable selection, e.g. "Top 20 of 100 by weightage · sector: Commercial Banks". */
  filterSummary: string;
  /** Total constituents in the dataset, so the export can show "20 of 100". */
  totalConstituents: number;
  /** Tickers removed with the company checklist. */
  excludedCompanies?: readonly string[];
  generatedAt?: Date;
}

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildFileName(meta: IndexMeta, date: Date): string {
  return `PSXEdge_${meta.slug}_Investment_Breakdown_${isoDate(date)}.xlsx`;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function originLabel(origin: IndexDataset['origin']): string {
  switch (origin) {
    case 'imported':
      return 'Imported file (validated in browser)';
    case 'live':
      return 'Live retrieval';
    default:
      return 'Bundled snapshot';
  }
}

/** Build the workbook. Exported separately so tests can inspect it without a DOM. */
export async function createInvestmentWorkbook({
  meta,
  dataset,
  breakdown,
  filterSummary,
  totalConstituents,
  excludedCompanies = [],
  generatedAt,
}: ExportParams) {
  const ExcelJS = await loadExcelJS();
  const now = generatedAt ?? new Date();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PSXEdge';
  workbook.lastModifiedBy = 'PSXEdge';
  workbook.created = now;
  workbook.modified = now;
  workbook.title = `PSXEdge ${meta.label} Investment Breakdown`;
  workbook.description = 'Smarter Allocation. Simpler Investing.';

  const { rows, totals } = breakdown;

  // ---------------------------------------------------------------- summary
  const summary = workbook.addWorksheet('Investment Summary', {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
  });

  summary.columns = [{ width: 30 }, { width: 46 }, { width: 26 }];

  summary.mergeCells('A1:C1');
  const titleCell = summary.getCell('A1');
  titleCell.value = 'PSXEdge — Investment Summary';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: COLORS.white } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brandDark } };
  summary.getRow(1).height = 34;

  summary.mergeCells('A2:C2');
  const tagline = summary.getCell('A2');
  tagline.value = 'Smarter Allocation. Simpler Investing.';
  tagline.font = { size: 10, italic: true, color: { argb: COLORS.muted } };
  tagline.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  summary.getRow(2).height = 20;

  let currentRow = 4;

  const addSection = (label: string) => {
    summary.mergeCells(currentRow, 1, currentRow, 3);
    const cell = summary.getCell(currentRow, 1);
    cell.value = label.toUpperCase();
    cell.font = { bold: true, size: 10, color: { argb: 'FF334155' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.section } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    summary.getRow(currentRow).height = 22;
    for (let col = 1; col <= 3; col += 1) {
      summary.getCell(currentRow, col).border = {
        bottom: { style: 'thin', color: { argb: COLORS.border } },
      };
    }
    currentRow += 1;
  };

  const addRow = (
    label: string,
    value: string | number,
    options?: { numFmt?: string; bold?: boolean; color?: string; wrap?: boolean },
  ) => {
    const labelCell = summary.getCell(currentRow, 1);
    labelCell.value = label;
    labelCell.font = { size: 11, color: { argb: 'FF334155' } };
    labelCell.alignment = { vertical: 'middle', indent: 1 };

    summary.mergeCells(currentRow, 2, currentRow, 3);
    const valueCell = summary.getCell(currentRow, 2);
    valueCell.value = value;
    valueCell.font = { size: 11, bold: options?.bold ?? false, color: { argb: options?.color ?? 'FF0F172A' } };
    valueCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: options?.wrap ?? false };
    if (options?.numFmt) valueCell.numFmt = options.numFmt;

    for (let col = 1; col <= 3; col += 1) {
      summary.getCell(currentRow, col).border = {
        bottom: { style: 'hair', color: { argb: COLORS.border } },
      };
    }
    summary.getRow(currentRow).height = options?.wrap ? 30 : 20;
    currentRow += 1;
  };

  addSection('Configuration');
  addRow('Application', 'PSXEdge');
  addRow('Selected Index', meta.label);
  addRow('Selection', filterSummary, { wrap: true });
  addRow('Weighting Method', 'Auto-normalised — adjusted weights total 100%');
  addRow('Constituents Included', `${rows.length} of ${totalConstituents}`);
  if (excludedCompanies.length > 0) {
    addRow('Unchecked Companies', excludedCompanies.join(', '), { wrap: true });
  }
  addRow('Data Source', dataset.sourceLabel);
  addRow('Data Retrieval Date', formatDateTime(dataset.retrievedAt));
  addRow('Dataset Type', originLabel(dataset.origin));
  if (dataset.importedFrom) addRow('Imported File', dataset.importedFrom);

  currentRow += 1;
  addSection('Investment Plan');
  addRow('Investment Amount (PKR)', Math.round(totals.totalInvestment), { numFmt: CURRENCY_FORMAT, bold: true });
  addRow('Applied Multiplier (auto-derived)', totals.multiplier, { numFmt: '0.0000"×"' });
  addRow('Total Adjusted Weightage', totals.adjustedWeightage, { numFmt: PERCENT_FORMAT, bold: true });
  addRow('Total Allocated Amount (PKR)', totals.allocatedAmount, { numFmt: CURRENCY_FORMAT, bold: true });

  if (totals.isOverAllocated) {
    addRow('Remaining Cash (PKR)', -Math.round(totals.overAllocatedBy), {
      numFmt: CURRENCY_FORMAT,
      bold: true,
      color: COLORS.negative,
    });
    addRow('Allocation Status', `Over-allocated by ${formatPKRAmount(totals.overAllocatedBy)} (adjusted weights exceed 100%)`, {
      color: COLORS.negative,
      bold: true,
    });
  } else {
    addRow('Remaining Cash (PKR)', totals.remainingCash, { numFmt: CURRENCY_FORMAT, bold: true });
    addRow('Allocation Status', 'Fully allocated within budget', { color: 'FF047857' });
  }

  currentRow += 1;
  summary.mergeCells(currentRow, 1, currentRow, 3);
  const noteCell = summary.getCell(currentRow, 1);
  noteCell.value =
    `Generated ${formatDateTime(now.toISOString())} in the browser by PSXEdge. ` +
    `The multiplier (${totals.multiplier.toFixed(4)}×) is derived as 100 ÷ the selected original weightages, so the selected adjusted weightages total 100%. ` +
    'Monetary values are rounded to whole rupees for display and export; verify current market data before trading.';
  noteCell.font = { size: 9, italic: true, color: { argb: COLORS.muted } };
  noteCell.alignment = { vertical: 'top', wrapText: true, indent: 1 };
  summary.getRow(currentRow).height = 54;

  summary.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // -------------------------------------------------------------- breakdown
  const sheet = workbook.addWorksheet('Company Breakdown', {
    properties: { defaultRowHeight: 18 },
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
  });

  const headers = [
    { header: 'Rank', key: 'rank', width: 8 },
    { header: 'Ticker', key: 'ticker', width: 13 },
    { header: 'Company Name', key: 'companyName', width: 42 },
    { header: 'Sector', key: 'sector', width: 36 },
    { header: 'Original Index Weightage (%)', key: 'original', width: 24 },
    { header: 'Multiplier', key: 'multiplier', width: 12 },
    { header: 'Adjusted Weightage (%)', key: 'adjusted', width: 22 },
    { header: 'Investment Amount (PKR)', key: 'investment', width: 24 },
  ];

  sheet.columns = headers.map((column) => ({ header: column.header, key: column.key, width: column.width }));

  const headerRow = sheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.header } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.header } },
      left: { style: 'thin', color: { argb: COLORS.header } },
      bottom: { style: 'thin', color: { argb: COLORS.header } },
      right: { style: 'thin', color: { argb: COLORS.header } },
    };
  });

  rows.forEach((row, position) => {
    const sheetRow = sheet.addRow({
      rank: row.rank,
      ticker: row.ticker,
      companyName: row.companyName,
      sector: row.sector,
      original: row.originalWeightage,
      multiplier: row.multiplier,
      adjusted: Number(row.adjustedWeightage.toFixed(4)),
      investment: row.allocationRounded,
    });
    sheetRow.height = 18;

    const zebra = position % 2 === 1;
    sheetRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: 'hair', color: { argb: COLORS.border } },
        left: { style: 'hair', color: { argb: COLORS.border } },
        bottom: { style: 'hair', color: { argb: COLORS.border } },
        right: { style: 'hair', color: { argb: COLORS.border } },
      };
      if (zebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebra } };
      }
      if (colNumber === 1 || colNumber === 6) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else if (colNumber === 5 || colNumber === 7 || colNumber === 8) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });

    sheetRow.getCell(2).font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
    sheetRow.getCell(5).numFmt = PERCENT_FORMAT;
    sheetRow.getCell(6).numFmt = '0.0000';
    sheetRow.getCell(7).numFmt = PERCENT_FORMAT;
    sheetRow.getCell(8).numFmt = CURRENCY_FORMAT;
    sheetRow.getCell(8).font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
  });

  const lastDataRow = rows.length + 1;
  const totalsRow = sheet.getRow(lastDataRow + 1);
  totalsRow.height = 24;
  totalsRow.values = [
    'Total',
    '',
    `${rows.length} of ${totalConstituents} companies`,
    '',
    Number(
      rows.reduce((sum, row) => sum + row.originalWeightage, 0).toFixed(4),
    ),
    '',
    Number(totals.adjustedWeightage.toFixed(4)),
    totals.allocatedAmount,
  ];
  totalsRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { bold: true, size: 11, color: { argb: COLORS.brandDark } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EF' } };
    cell.border = {
      top: { style: 'medium', color: { argb: COLORS.brand } },
      left: { style: 'hair', color: { argb: COLORS.border } },
      bottom: { style: 'thin', color: { argb: COLORS.border } },
      right: { style: 'hair', color: { argb: COLORS.border } },
    };
    cell.alignment = { vertical: 'middle', horizontal: colNumber >= 2 ? 'right' : 'left' };
  });
  totalsRow.getCell(5).numFmt = PERCENT_FORMAT;
  totalsRow.getCell(7).numFmt = PERCENT_FORMAT;
  totalsRow.getCell(8).numFmt = CURRENCY_FORMAT;

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastDataRow, column: headers.length } };

  // Footnote under the totals row (does not affect the filter range).
  const footnote = sheet.getRow(lastDataRow + 3);
  footnote.getCell(1).value = `PSXEdge • ${meta.label} • auto multiplier ${totals.multiplier.toFixed(
    4,
  )}× • ${filterSummary} • generated ${formatDateTime(now.toISOString())} • source: ${dataset.sourceLabel}`;
  footnote.getCell(1).font = { size: 9, italic: true, color: { argb: COLORS.muted } };

  sheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:1',
  };

  return workbook;
}

/** Build the workbook and trigger a browser download. Returns the file name. */
export async function exportInvestmentWorkbook(params: ExportParams): Promise<string> {
  const now = params.generatedAt ?? new Date();
  const workbook = await createInvestmentWorkbook({ ...params, generatedAt: now });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const fileName = buildFileName(params.meta, now);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000);

  return fileName;
}

