import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Header } from '../../components/Header/Header';
import { InvestmentInput } from '../../components/InvestmentInput/InvestmentInput';
import { InvestmentSummary } from '../../components/InvestmentSummary/InvestmentSummary';
import { InvestmentTable } from '../../components/InvestmentTable/InvestmentTable';
import { MultiplierPanel } from '../../components/MultiplierPanel/MultiplierPanel';
import { PriceDialog } from '../../components/PriceDialog/PriceDialog';
import { DataStatus } from '../../components/DataRefresh/DataStatus';
import { DataImportDialog } from '../../components/DataImport/DataImportDialog';
import { Toast, type ToastMessage, type ToastTone } from '../../components/Toast/Toast';
import { INDEX_META, isIndexKey } from '../../data/indexMeta';
import { useIndexData } from '../../hooks/useIndexData';
import { useInvestmentCalculator } from '../../hooks/useInvestmentCalculator';
import { useSharePrices } from '../../hooks/useSharePrices';
import { useTheme } from '../../hooks/useTheme';
import { STORAGE_KEYS, readJSON, readRaw, writeRaw, writeJSON } from '../../lib/storage';
import { exportInvestmentWorkbook } from '../../services/excelExportService';
import {
  createDefaultFilter,
  describeFilter,
  filterConstituents,
  rankConstituents,
  sectorOptions,
} from '../../services/investmentCalculator';
import { parseAmountInput } from '../../utils/currencyFormatter';
import { priceSetLabel } from '../../services/priceService';
import type { IndexDataset, IndexKey } from '../../types';
import type { AllocationFilter, TopNSelection } from '../../types/investment';

const DEFAULT_INVESTMENT = '100000';

function initialInvestmentRaw(): string {
  const stored = readRaw(STORAGE_KEYS.investment);
  return stored ?? DEFAULT_INVESTMENT;
}

function isTopNSelection(value: unknown): value is TopNSelection {
  return value === 'all' || (typeof value === 'number' && Number.isInteger(value) && value > 0);
}

function initialFilters(): Record<IndexKey, AllocationFilter> {
  const stored = readJSON<Partial<Record<IndexKey, Partial<AllocationFilter>>>>(STORAGE_KEYS.filters);
  const build = (key: IndexKey): AllocationFilter => {
    const value = stored?.[key];
    return {
      // Search terms are intentionally not persisted — a stale query would hide the list on reopen.
      topN: isTopNSelection(value?.topN) ? value.topN : 'all',
      sector: typeof value?.sector === 'string' && value.sector.trim() !== '' ? value.sector : 'all',
      search: '',
      excluded: Array.isArray(value?.excluded)
        ? [...new Set(value.excluded.filter((ticker): ticker is string => typeof ticker === 'string'))]
        : [],
    };
  };
  return { KSE100: build('KSE100'), KMI30: build('KMI30') };
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
  const [filters, setFilters] = useState<Record<IndexKey, AllocationFilter>>(initialFilters);
  const { priceSet, setPrice, applyPrices, resetToSnapshot } = useSharePrices(index);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastId = useRef(0);

  const showToast = useCallback((tone: ToastTone, title: string, description?: string) => {
    toastId.current += 1;
    setToast({ id: toastId.current, tone, title, description });
  }, []);

  useEffect(() => {
    writeRaw(STORAGE_KEYS.investment, investmentRaw);
  }, [investmentRaw]);

  const parsedAmount = parseAmountInput(investmentRaw);
  const totalInvestment = parsedAmount ?? 0;
  const investmentError =
    investmentRaw.trim() !== '' && (parsedAmount === null || parsedAmount <= 0)
      ? 'Enter an investment amount greater than zero.'
      : null;

  const ranked = useMemo(() => rankConstituents(dataset.constituents), [dataset.constituents]);
  const sectors = useMemo(() => sectorOptions(ranked), [ranked]);

  // A sector saved for a previous dataset may no longer exist after an import.
  const filter = useMemo<AllocationFilter>(() => {
    const current = filters[index] ?? createDefaultFilter();
    let next = current;
    // A preset saved for a bigger dataset (or a sector from a previous import) may not apply any more.
    if (next.topN !== 'all' && next.topN >= ranked.length) next = { ...next, topN: 'all' };
    if (next.sector !== 'all' && !sectors.includes(next.sector)) next = { ...next, sector: 'all' };
    return next;
  }, [filters, index, ranked.length, sectors]);

  // Candidates = what the shortlist/sector/search allow; the checklist then excludes tickers.
  const candidates = useMemo(
    () => filterConstituents(ranked, { ...filter, excluded: [] }),
    [ranked, filter],
  );
  const visible = useMemo(() => filterConstituents(ranked, filter), [ranked, filter]);
  const selectedWeightTotal = useMemo(
    () => visible.reduce((sum, constituent) => sum + constituent.weightage, 0),
    [visible],
  );

  const breakdown = useInvestmentCalculator({
    ranked: visible,
    totalInvestment,
    prices: priceSet.prices,
    index,
  });

  const handleFilterChange = useCallback(
    (next: AllocationFilter) => {
      setFilters((current) => ({ ...current, [index]: next }));
    },
    [index],
  );

  useEffect(() => {
    writeJSON(STORAGE_KEYS.filters, { ...filters, [index]: filter });
  }, [filters, index, filter]);

  const handleRefresh = useCallback(async () => {
    const result = await refresh();
    if (result.ok) {
      showToast('success', 'Data refreshed', result.message);
    } else if (result.corsBlocked) {
      // The proxy was unavailable and the direct fallback hit PSX's missing CORS header.
      showToast(
        'info',
        'Proxy unavailable — PSX blocked the direct request',
        'Refresh normally goes through the /psx proxy on Vercel and updates both KSE-100 and KMI-30. From this host the proxy could not be reached, so the browser fell back to direct requests and PSX blocked them (no CORS header). Both datasets are unchanged — import a CSV/XLSX or connect a feed to update them.',
      );
    } else {
      showToast(
        'error',
        'Live refresh failed',
        'Neither the /psx proxy nor the feed could be reached. Both datasets are unchanged — try again, or import a CSV/XLSX file.',
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
    if (exporting) return;
    if (breakdown.rows.length === 0) {
      showToast('info', 'Nothing to export', 'No companies match the current filters — reset them and try again.');
      return;
    }
    setExporting(true);
    try {
      const fileName = await exportInvestmentWorkbook({
        meta,
        dataset,
        breakdown,
        filterSummary: describeFilter(filter, ranked.length),
        totalConstituents: ranked.length,
        excludedCompanies: filter.excluded ?? [],
        priceInfo: {
          label: priceSetLabel(priceSet),
          updatedAt: priceSet.updatedAt,
          edited: priceSet.edited,
        },
      });
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
  }, [breakdown, dataset, exporting, filter, meta, priceSet, ranked.length, showToast]);

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
              Every constituent is listed. Weights normalise to 100% automatically, and each holding is floored to whole
              shares so you never spend above the budget.
            </p>
          </div>
          <p className="hidden text-[11px] text-ink-400 dark:text-ink-500 sm:block">
            Every field updates instantly · calculations stay in your browser
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <InvestmentInput rawValue={investmentRaw} onChange={setInvestmentRaw} error={investmentError} />
          <MultiplierPanel
            multiplier={breakdown.totals.multiplier}
            weightTotal={selectedWeightTotal}
            selectedCount={visible.length}
            totalCount={ranked.length}
          />
        </div>

        <div className="mt-3">
          <InvestmentSummary totals={breakdown.totals} />
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
          <InvestmentTable
            rows={breakdown.rows}
            totals={breakdown.totals}
            meta={meta}
            filter={filter}
            onFilterChange={handleFilterChange}
            sectors={sectors}
            totalCount={ranked.length}
            companies={candidates}
            priceLabel={priceSetLabel(priceSet)}
            priceUpdatedAt={priceSet.updatedAt}
            priceEdited={priceSet.edited}
            onPriceChange={setPrice}
            onOpenPrices={() => setPricesOpen(true)}
          />
        </div>

        <footer className="mt-6 flex flex-col gap-2 border-t border-ink-200 pt-4 text-[11px] leading-relaxed text-ink-400 dark:border-ink-800 dark:text-ink-500 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl">
            PSXEdge is an educational allocation calculator, not investment advice, and is not affiliated with the
            Pakistan Stock Exchange. Index weightages and share prices change constantly — verify both at{' '}
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

      <PriceDialog
        open={pricesOpen}
        index={index}
        meta={meta}
        priceSet={priceSet}
        tickers={ranked.map((company) => company.ticker)}
        onApply={applyPrices}
        onReset={resetToSnapshot}
        onClose={() => setPricesOpen(false)}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
