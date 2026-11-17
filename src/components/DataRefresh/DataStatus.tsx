import { useEffect, useState } from 'react';
import { AlertTriangle, Database, Info, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatTimestamp } from '../../services/indexDataService';
import type { AttemptLog, IndexDataset, IndexMeta } from '../../types';

interface DataStatusProps {
  dataset: IndexDataset;
  meta: IndexMeta;
  stale: boolean;
  ageDays: number;
  refreshing: boolean;
  attempts: AttemptLog[];
  onImport: () => void;
  onRefresh: () => void;
  onResetToBundled: () => void;
}

const ORIGIN_LABEL: Record<IndexDataset['origin'], string> = {
  bundled: 'Bundled snapshot',
  imported: 'Imported file',
  live: 'Live data',
};

const ORIGIN_CLASS: Record<IndexDataset['origin'], string> = {
  bundled: 'border-ink-200 bg-ink-50 text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300',
  imported: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
  live: 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300',
};

export function DataStatus({
  dataset,
  meta,
  stale,
  ageDays,
  refreshing,
  attempts,
  onImport,
  onRefresh,
  onResetToBundled,
}: DataStatusProps) {
  const failedAttempts = attempts.filter((attempt) => !attempt.ok);
  const corsBlocked = attempts.some((attempt) => attempt.corsBlocked);
  const [showInfo, setShowInfo] = useState(false);
  // Open the explanation automatically the first time a refresh is blocked,
  // so the CORS message is never a mystery.
  useEffect(() => {
    if (corsBlocked) setShowInfo(true);
  }, [corsBlocked]);

  const ageLabel =
    ageDays < 1 ? 'today' : `${Math.floor(ageDays)} ${Math.floor(ageDays) === 1 ? 'day' : 'days'} old`;

  return (
    <section aria-label="Dataset status" className="rounded-xl border border-ink-200 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300">
            <Database className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500">
                Data
              </span>
              <span
                className={cn(
                  'rounded-md border px-1.5 py-0.5 text-[10px] font-semibold',
                  ORIGIN_CLASS[dataset.origin],
                )}
              >
                {ORIGIN_LABEL[dataset.origin]}
              </span>
              {dataset.origin === 'bundled' ? (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  Not live
                </span>
              ) : null}
              {stale ? (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  Stale · {ageLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-xs font-medium text-ink-700 dark:text-ink-200" title={dataset.sourceLabel}>
              {dataset.sourceLabel}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-400 dark:text-ink-500">
              {dataset.constituents.length} constituents · {meta.label} · updated {formatTimestamp(dataset.retrievedAt)}
              {dataset.sourceUrl ? (
                <>
                  {' · '}
                  <a
                    href={dataset.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline decoration-ink-300 underline-offset-2 hover:text-ink-600 dark:decoration-ink-600 dark:hover:text-ink-300"
                  >
                    source
                  </a>
                </>
              ) : null}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {dataset.origin !== 'bundled' ? (
            <button
              type="button"
              onClick={onResetToBundled}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Use bundled
            </button>
          ) : null}
          <button
            type="button"
            onClick={onImport}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Import data
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            title="Try a live fetch. PSX blocks browser requests (CORS), so PSXEdge keeps the last validated dataset."
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 disabled:cursor-wait disabled:opacity-60 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:bg-ink-800"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />
            {refreshing ? 'Checking…' : 'Refresh'}
          </button>
        </div>
      </div>

      {stale ? (
        <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-[11px] leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>
            This {meta.label} dataset is {ageLabel}. PSXEdge keeps using the last successfully validated data rather than
            inventing values — refresh it, or import the latest constituent file before relying on these allocations.
          </p>
        </div>
      ) : null}

      <details
        open={showInfo}
        onToggle={(event) => setShowInfo((event.currentTarget as HTMLDetailsElement).open)}
        className="group border-t border-ink-200 px-4 py-2 dark:border-ink-800"
      >
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-medium text-ink-500 outline-none hover:text-ink-700 dark:text-ink-400 dark:hover:text-ink-200">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          Live refresh, CORS and data sources
          {failedAttempts.length > 0 ? (
            <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
              PSX blocked the request
            </span>
          ) : null}
        </summary>

        <div className="mt-2 max-w-3xl space-y-2 text-[11px] leading-relaxed text-ink-500 dark:text-ink-400">
          <p>
            <span className="font-semibold text-ink-700 dark:text-ink-200">
              The CORS warning in your browser console is expected — it is not an error in PSXEdge.
            </span>{' '}
            PSX&apos;s Data Portal (<span className="font-mono text-[10px]">dps.psx.com.pk</span>) answers with HTML but does
            not send an <code className="rounded bg-ink-100 px-1 font-mono text-[10px] dark:bg-ink-800">Access-Control-Allow-Origin</code>{' '}
            header. Browsers block every cross-origin read by design, and PSXEdge deliberately has no backend or proxy to
            work around it. Your last validated dataset keeps being used and nothing on screen changes.
          </p>
          <p className="font-medium text-ink-600 dark:text-ink-300">To update the data, use one of these:</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              <span className="font-medium text-ink-600 dark:text-ink-300">Import data</span> — drop a CSV/TSV or XLSX
              export of the constituents. It is parsed and validated entirely in your browser.
            </li>
            <li>
              <span className="font-medium text-ink-600 dark:text-ink-300">Connect a CORS-enabled feed</span> — a JSON URL
              you host somewhere that allows cross-origin reads (Advanced section of the import dialog). Refresh will use
              it before falling back to PSX.
            </li>
            <li>
              <span className="font-medium text-ink-600 dark:text-ink-300">Keep the bundled snapshot</span> — labelled
              point-in-time PSX data that ships with each release.
            </li>
          </ol>
          {attempts.length > 0 ? (
            <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-2.5 dark:border-ink-800 dark:bg-ink-950/40">
              <p className="mb-1 font-medium text-ink-600 dark:text-ink-300">Last refresh attempt</p>
              <ul className="space-y-1">
                {attempts.map((attempt) => (
                  <li key={attempt.label} className="flex gap-1.5">
                    <span
                      className={
                        attempt.ok ? 'text-brand-600 dark:text-brand-400' : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {attempt.ok ? '✓' : '!'}
                    </span>
                    <span>
                      <span className="font-medium text-ink-600 dark:text-ink-300">{attempt.label}</span>
                      {attempt.ok ? ' — succeeded.' : ` — ${attempt.message ?? 'failed.'}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}
