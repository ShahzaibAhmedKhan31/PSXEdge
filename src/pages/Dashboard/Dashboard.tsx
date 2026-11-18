import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '../../components/Header/Header';
import { InvestmentInput } from '../../components/InvestmentInput/InvestmentInput';
import { InvestmentSummary } from '../../components/InvestmentSummary/InvestmentSummary';
import { OverAllocationAlert } from '../../components/InvestmentSummary/OverAllocationAlert';
import { InvestmentTable } from '../../components/InvestmentTable/InvestmentTable';
import { MultiplierInput } from '../../components/MultiplierInput/MultiplierInput';
import { DataStatus } from '../../components/DataRefresh/DataStatus';
import { DataImportDialog } from '../../components/DataImport/DataImportDialog';
import { Toast, type ToastMessage, type ToastTone } from '../../components/Toast/Toast';
import { INDEX_META, isIndexKey } from '../../data/indexMeta';
import { useIndexData } from '../../hooks/useIndexData';
import { useInvestmentCalculator } from '../../hooks/useInvestmentCalculator';
import { useTheme } from '../../hooks/useTheme';
import { STORAGE_KEYS, readJSON, readRaw, writeRaw, writeJSON } from '../../lib/storage';
import { exportInvestmentWorkbook } from '../../services/excelExportService';
import { parseAmountInput } from '../../utils/currencyFormatter';
import type { IndexDataset, IndexKey } from '../../types';

const DEFAULT_INVESTMENT = '100000';

function initialInvestmentRaw(): string {
  const stored = readRaw(STORAGE_KEYS.investment);
  return stored ?? DEFAULT_INVESTMENT;
}

function initialMultipliers(): Record<IndexKey, number> {
  const stored = readJSON<Partial<Record<IndexKey, number>>>(STORAGE_KEYS.multipliers);
  const fallback = {
    KSE100: INDEX_META.KSE100.defaultMultiplier,
    KMI30: INDEX_META.KMI30.defaultMultiplier,
  };
  if (!stored) return fallback;

  return {
    KSE100:
      typeof stored.KSE100 === 'number' && Number.isFinite(stored.KSE100) && stored.KSE100 > 0
        ? stored.KSE100
        : fallback.KSE100,
    KMI30:
      typeof stored.KMI30 === 'number' && Number.isFinite(stored.KMI30) && stored.KMI30 > 0
        ? stored.KMI30
        : fallback.KMI30,
  };
}

export function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  const {
    index,
    meta,
    dataset,
    setIndex,
    refresh,
    importDataset,
    resetToBundled,
    refreshing,
    attempts,
    stale,
    ageDays,
  } = useIndexData();

  const [investmentRaw, setInvestmentRaw] = useState(initialInvestmentRaw);
  const [multipliers, setMultipliers] = useState<Record<IndexKey, number>>(initialMultipliers);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastId = useRef(0);

  const showToast = useCallback((tone: ToastTone, title: string, description?: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, tone, title, description });
  }, []);

  useEffect(() => {
    writeRaw(STORAGE_KEYS.investment, investmentRaw);
  }, [investmentRaw]);

  useEffect(() => {
    writeJSON(STORAGE_KEYS.multipliers, multipliers);
  }, [multipliers]);

  const parsedAmount = parseAmountInput(investmentRaw);
  const totalInvestment = parsedAmount ?? 0;
  const investmentError =
    investmentRaw.trim() !== '' && (parsedAmount === null || parsedAmount <= 0)
      ? 'Enter an investment amount greater than zero.'
      : null;

  const multiplier = multipliers[index];

  const breakdown = useInvestmentCalculator({
    constituents: dataset.constituents,
    totalInvestment,
    multiplier,
    topN: meta.topN,
    index,
  });

  const example = useMemo(() => {
    const first = breakdown.rows[0];
    return first
      ? {
          ticker: first.ticker,
          originalWeightage: first.originalWeightage,
          adjustedWeightage: first.adjustedWeightage,
        }
      : undefined;
  }, [breakdown.rows]);

  const handleMultiplierChange = useCallback(
    (value: number) => {
      setMultipliers((current) => (current[index] === value ? current : { ...current, [index]: value }));
    },
    [index],
  );

  const handleRefresh = useCallback(async () => {
    const result = await refresh();
    if (result.ok) {
      showToast('success', 'Data refreshed', result.message);
    } else if (result.corsBlocked) {
      // The proxy was unavailable and the direct fallback hit PSX's missing CORS header.
      showToast(
        'info',
        'Proxy unavailable — PSX blocked the direct request',
        'Refresh normally goes through the /psx proxy on Vercel. From this host it could not be reached, so the browser fell back to a direct request and PSX blocked it (no CORS header). Your last validated dataset is still in use — import a CSV/XLSX or connect a feed to update it.',
      );
    } else {
      showToast(
        'error',
        'Live refresh failed',
        'Neither the /psx proxy nor the feed could be reached. Your last validated dataset is still in use — try again, or import a CSV/XLSX file.',
      );
    }
  }, [refresh, showToast]);

  const handleResetToBundled = useCallback(() => {
    resetToBundled();
    showToast('info', 'Using bundled snapshot', `PSXEdge fell back to the labelled ${meta.label} snapshot.`);
  }, [meta.label, resetToBundled, showToast]);

  const handleImported = useCallback(
    (next: IndexDataset) => {
      importDataset(next);
      showToast('success', `${INDEX_META[next.index].label} data imported`, next.sourceLabel);
    },
    [importDataset, showToast],
  );

  const handleExport = useCallback(async () => {
    if (exporting || breakdown.rows.length === 0) return;
    setExporting(true);
    try {
      const fileName = await exportInvestmentWorkbook({ meta, dataset, breakdown });
      showToast('success', 'Excel workbook exported', fileName);
    } catch (error) {
      showToast(
        'error',
        'Export failed',
        error instanceof Error ? error.message : 'The workbook could not be generated in this browser.',
      );
    } finally {
      setExporting(false);
    }
  }, [breakdown, dataset, exporting, meta, showToast]);

  return (
    <div className="flex min-h-full flex-col bg-ink-50 text-ink-900 dark:bg-ink-950 dark:text-ink-100">
      <Header
        index={index}
        onIndexChange={setIndex}
        theme={theme}
        onToggleTheme={toggleTheme}
        lastUpdated={dataset.retrievedAt}
        refreshing={refreshing}
        onRefresh={() => void handleRefresh()}
        onExport={() => void handleExport()}
        exporting={exporting}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-14 pt-5 sm:px-6 sm:pt-6 lg:px-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink-900 dark:text-white sm:text-lg">
              Allocation calculator
            </h2>
            <p className="text-xs text-ink-500 dark:text-ink-400">
              Weights are never normalised — adjust the multiplier to control exposure.
            </p>
          </div>
          <p className="hidden text-[11px] text-ink-400 dark:text-ink-500 sm:block">
            Every field updates instantly · calculations stay in your browser
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <InvestmentInput rawValue={investmentRaw} onChange={setInvestmentRaw} error={investmentError} />
          <MultiplierInput
            value={multiplier}
            defaultValue={meta.defaultMultiplier}
            onChange={handleMultiplierChange}
            example={example}
          />
        </div>

        <div className="mt-3">
          <InvestmentSummary totals={breakdown.totals} />
        </div>

        <div className="mt-3">
          <OverAllocationAlert totals={breakdown.totals} />
        </div>

        <div className="mt-3">
          <DataStatus
            dataset={dataset}
            meta={meta}
            stale={stale}
            ageDays={ageDays}
            refreshing={refreshing}
            attempts={attempts}
            onImport={() => setImportOpen(true)}
            onRefresh={() => void handleRefresh()}
            onResetToBundled={handleResetToBundled}
          />
        </div>

        <div className="mt-3">
          <InvestmentTable rows={breakdown.rows} totals={breakdown.totals} meta={meta} />
        </div>

        <footer className="mt-6 flex flex-col gap-2 border-t border-ink-200 pt-4 text-[11px] leading-relaxed text-ink-400 dark:border-ink-800 dark:text-ink-500 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl">
            PSXEdge is an educational allocation calculator, not investment advice, and is not affiliated with the
            Pakistan Stock Exchange. Index weightages change with prices and recompositions — verify them at{' '}
            <a
              href="https://www.psx.com.pk"
              target="_blank"
              rel="noreferrer noopener"
              className="underline decoration-ink-300 underline-offset-2 hover:text-ink-600 dark:decoration-ink-600 dark:hover:text-ink-300"
            >
              psx.com.pk
            </a>{' '}
            before trading.
          </p>
          <p className="shrink-0 sm:text-right">
            Data & preferences stay in this browser.
            <br />
            PSXEdge · v1.0
          </p>
        </footer>
      </main>

      <DataImportDialog
        open={importOpen}
        initialIndex={isIndexKey(index) ? index : 'KSE100'}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
        onResetToBundled={handleResetToBundled}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
