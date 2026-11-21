import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, X } from 'lucide-react';
import { INDEX_KEYS, INDEX_META } from '../../data/indexMeta';
import { cn } from '../../lib/cn';
import { STORAGE_KEYS, readRaw, writeRaw } from '../../lib/storage';
import { isPsxUrl } from '../../services/indexDataService';
import {
  analyzeFile,
  datasetFromImport,
  downloadCsvTemplate,
  readSpreadsheetFile,
  type ParsedFile,
} from '../../services/importService';
import type { ImportAnalysis } from '../../utils/dataValidator';
import { formatPercent } from '../../utils/percentageFormatter';
import type { IndexDataset, IndexKey } from '../../types';

interface DataImportDialogProps {
  open: boolean;
  initialIndex: IndexKey;
  onClose: () => void;
  onImported: (dataset: IndexDataset) => void;
  onResetToBundled: () => void;
}

const ACCEPTED = '.csv,.tsv,.txt,.xlsx,.xlsm';

export function DataImportDialog({ open, initialIndex, onClose, onImported, onResetToBundled }: DataImportDialogProps) {
  const [targetIndex, setTargetIndex] = useState<IndexKey>(initialIndex);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [feedUrl, setFeedUrl] = useState(() => readRaw(STORAGE_KEYS.feedUrl) ?? '');
  const [feedStatus, setFeedStatus] = useState<string | null>(null);

  const meta = INDEX_META[targetIndex];

  const reset = useCallback(() => {
    setTargetIndex(initialIndex);
    setParsed(null);
    setAnalysis(null);
    setFileError(null);
    setReading(false);
    setDragging(false);
    setFeedStatus(null);
  }, [initialIndex]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      setReading(true);
      setFileError(null);
      setParsed(null);
      setAnalysis(null);
      try {
        const nextParsed = await readSpreadsheetFile(file);
        setParsed(nextParsed);
        setAnalysis(analyzeFile(nextParsed, INDEX_META[targetIndex]));
      } catch (error) {
        setFileError(error instanceof Error ? error.message : 'The file could not be read.');
      } finally {
        setReading(false);
      }
    },
    [targetIndex],
  );

  const handleTargetChange = (next: IndexKey) => {
    setTargetIndex(next);
    if (parsed) {
      setAnalysis(analyzeFile(parsed, INDEX_META[next]));
    }
  };

  const handleConfirm = () => {
    if (!analysis?.ok || !parsed) return;
    const dataset = datasetFromImport({ index: targetIndex, analysis, fileName: parsed.fileName });
    onImported(dataset);
    onClose();
  };

  const saveFeed = () => {
    const trimmed = feedUrl.trim();
    if (trimmed === '') {
      writeRaw(STORAGE_KEYS.feedUrl, '');
      setFeedStatus('Custom feed cleared.');
      return;
    }
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('bad protocol');
    } catch {
      setFeedStatus('Enter a valid http(s) URL.');
      return;
    }
    if (isPsxUrl(trimmed)) {
      setFeedStatus(
        'That is a PSX URL — PSX sends no CORS headers, so a browser can never read it. Save a JSON file you host instead, or leave this blank to use the /psx proxy.',
      );
      return;
    }
    writeRaw(STORAGE_KEYS.feedUrl, trimmed);
    setFeedStatus('Feed saved. Use Refresh to fetch from it.');
  };

  const clearFeed = () => {
    setFeedUrl('');
    writeRaw(STORAGE_KEYS.feedUrl, '');
    setFeedStatus('Custom feed cleared. Refresh now uses the /psx proxy.');
  };

  const previewRows = useMemo(() => analysis?.all.slice(0, 8) ?? [], [analysis]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
        className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-ink-200 bg-white shadow-pop animate-fade-in dark:border-ink-800 dark:bg-ink-900 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4 dark:border-ink-800">
          <div>
            <h2 id="import-dialog-title" className="text-base font-semibold tracking-tight text-ink-900 dark:text-white">
              Import index data
            </h2>
            <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
              Parsed entirely in your browser — nothing is uploaded anywhere.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import dialog"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              1 · Which index is this data for?
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {INDEX_KEYS.map((key) => {
                const keyMeta = INDEX_META[key];
                const active = key === targetIndex;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTargetChange(key)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                      active
                        ? 'border-brand-600/40 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10'
                        : 'border-ink-200 bg-white hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:hover:bg-ink-800',
                    )}
                  >
                    <span
                      className={cn(
                        'block text-sm font-semibold',
                        active ? 'text-brand-800 dark:text-brand-300' : 'text-ink-800 dark:text-ink-100',
                      )}
                    >
                      {keyMeta.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-500 dark:text-ink-400">
                      Needs at least {keyMeta.minConstituents} companies
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
              2 · Upload a CSV or Excel file
            </p>

            {parsed ? (
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-ink-200 bg-ink-50/60 px-3 py-2.5 dark:border-ink-700 dark:bg-ink-950/40">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-ink-800 dark:text-ink-100">{parsed.fileName}</p>
                  <p className="text-[11px] text-ink-500 dark:text-ink-400">
                    {analysis?.rowsRead ?? 0} data rows · {parsed.sheetNote}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setParsed(null);
                    setAnalysis(null);
                    setFileError(null);
                  }}
                  className="text-[11px] font-medium text-ink-500 underline underline-offset-2 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
                >
                  Change
                </button>
              </div>
            ) : (
              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void handleFiles(event.dataTransfer.files);
                }}
                className={cn(
                  'mt-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors',
                  dragging
                    ? 'border-brand-500 bg-brand-50/60 dark:border-brand-400 dark:bg-brand-500/10'
                    : 'border-ink-300 bg-ink-50/40 hover:border-ink-400 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-950/30 dark:hover:border-ink-600 dark:hover:bg-ink-800/40',
                )}
              >
                <input
                  type="file"
                  accept={ACCEPTED}
                  className="sr-only"
                  onChange={(event) => {
                    void handleFiles(event.target.files);
                    event.target.value = '';
                  }}
                />
                {reading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-brand-600 dark:text-brand-400" aria-hidden="true" />
                ) : (
                  <Upload className="h-5 w-5 text-ink-400" aria-hidden="true" />
                )}
                <span className="text-xs font-semibold text-ink-700 dark:text-ink-200">
                  {reading ? 'Reading file…' : 'Drop a file here, or click to browse'}
                </span>
                <span className="text-[11px] text-ink-500 dark:text-ink-400">
                  CSV, TSV, XLSX or XLSM · up to 8 MB
                </span>
                <span className="mt-0.5 text-[11px] text-ink-400 dark:text-ink-500">
                  Columns: ticker, company name, sector, weightage
                </span>
              </label>
            )}

            {fileError ? (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{fileError}</span>
              </div>
            ) : null}

            {analysis ? (
              <div className="mt-3 space-y-2.5">
                <div
                  className={cn(
                    'flex items-start gap-2 rounded-lg border px-3 py-2 text-[11px] leading-relaxed',
                    analysis.ok
                      ? 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
                  )}
                >
                  {analysis.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <div>
                    {analysis.ok ? (
                      <p className="font-semibold">
                        {analysis.all.length} valid companies · total weight{' '}
                        {formatPercent(analysis.totalWeightage)}
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {analysis.errors.map((error) => (
                          <li key={error} className="font-medium">
                            {error}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {analysis.warnings.length > 0 ? (
                  <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                    {analysis.warnings.map((warning) => (
                      <li key={warning} className="flex gap-1.5">
                        <span aria-hidden="true">•</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {analysis.ok && previewRows.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-ink-200 dark:border-ink-800">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-ink-50 text-left uppercase tracking-wider text-ink-500 dark:bg-ink-950/60 dark:text-ink-400">
                          <th scope="col" className="px-2.5 py-1.5 font-semibold">
                            Ticker
                          </th>
                          <th scope="col" className="px-2.5 py-1.5 font-semibold">
                            Company
                          </th>
                          <th scope="col" className="px-2.5 py-1.5 text-right font-semibold">
                            Weight
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row) => (
                          <tr key={row.ticker} className="border-t border-ink-100 dark:border-ink-800/70">
                            <td className="px-2.5 py-1.5 font-mono font-semibold text-ink-700 dark:text-ink-200">
                              {row.ticker}
                            </td>
                            <td className="max-w-[220px] truncate px-2.5 py-1.5 text-ink-600 dark:text-ink-300">
                              {row.companyName}
                            </td>
                            <td className="px-2.5 py-1.5 text-right tabular-nums text-ink-600 dark:text-ink-300">
                              {formatPercent(row.weightage)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="border-t border-ink-100 px-2.5 py-1.5 text-[10px] text-ink-400 dark:border-ink-800 dark:text-ink-500">
                      Preview shows the first {previewRows.length} of {analysis.all.length} valid companies.
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => downloadCsvTemplate(targetIndex)}
              className="mt-2 text-[11px] font-medium text-ink-500 underline underline-offset-2 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
            >
              Download a CSV template ({meta.label})
            </button>
          </div>

          <details className="rounded-lg border border-ink-200 bg-ink-50/40 px-3 py-2 dark:border-ink-800 dark:bg-ink-950/30">
            <summary className="cursor-pointer text-[11px] font-semibold text-ink-600 dark:text-ink-300">
              Advanced · connect a CORS-enabled live feed
            </summary>
            <div className="mt-2 space-y-2">
              <p className="text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
                PSX's own portal cannot be read by a browser (no CORS headers), so a PSX URL will never work here. If
                you host a CORS-enabled JSON endpoint — for example a static file on GitHub Pages — paste it here. It is
                tried first for the selected index when you refresh; the other index uses the /psx proxy. Leave this
                blank to always use the proxy. Expected shape:{' '}
                <code className="rounded bg-ink-100 px-1 py-0.5 font-mono text-[10px] text-ink-700 dark:bg-ink-800 dark:text-ink-200">
                  {'{ "constituents": [{ "ticker": "FFC", "companyName": "…", "sector": "…", "weightage": 9.13 }] }'}
                </code>
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={feedUrl}
                  onChange={(event) => {
                    setFeedUrl(event.target.value);
                    setFeedStatus(null);
                  }}
                  placeholder="https://example.com/psx-kse100.json"
                  className="h-8 flex-1 rounded-md border border-ink-200 bg-white px-2 text-[11px] text-ink-800 outline-none placeholder:text-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-100"
                />
                <button
                  type="button"
                  onClick={saveFeed}
                  className="h-8 rounded-md border border-ink-200 bg-white px-2.5 text-[11px] font-semibold text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800"
                >
                  Save
                </button>
                {feedUrl.trim() ? (
                  <button
                    type="button"
                    onClick={clearFeed}
                    className="h-8 rounded-md px-2 text-[11px] font-medium text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              {feedStatus ? <p className="text-[11px] font-medium text-ink-500 dark:text-ink-400">{feedStatus}</p> : null}
            </div>
          </details>
        </div>

        <div className="flex flex-col gap-2 border-t border-ink-200 px-5 py-3 dark:border-ink-800 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => {
              onResetToBundled();
              onClose();
            }}
            className="text-[11px] font-medium text-ink-500 underline underline-offset-2 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200"
          >
            Use bundled snapshot (active index)
          </button>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-ink-200 bg-white px-3 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!analysis?.ok}
              className="h-9 rounded-lg bg-brand-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use this data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
