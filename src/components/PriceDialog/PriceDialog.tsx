import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatTimestamp } from '../../services/indexDataService';
import {
  formatPriceList,
  parsePriceList,
  priceSetLabel,
  snapshotPriceSet,
  type PriceSet,
} from '../../services/priceService';
import type { IndexKey, IndexMeta } from '../../types';

interface PriceDialogProps {
  open: boolean;
  index: IndexKey;
  meta: IndexMeta;
  priceSet: PriceSet;
  /** Every constituent ticker of the active index, in rank order. */
  tickers: readonly string[];
  onApply: (prices: Record<string, number>, removed: readonly string[]) => void;
  onReset: () => void;
  onClose: () => void;
}

/**
 * Paste a whole price list at once. Accepts "TICKER, PRICE" (also spaces, tabs
 * or colons); invalid lines are reported and simply skipped.
 */
export function PriceDialog({
  open,
  index,
  meta,
  priceSet,
  tickers,
  onApply,
  onReset,
  onClose,
}: PriceDialogProps) {
  const initialDraft = useMemo(
    () => formatPriceList(tickers, priceSet.prices),
    [tickers, priceSet.prices],
  );
  const [draft, setDraft] = useState(initialDraft);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(initialDraft);
    setFeedback(null);
  }, [open, initialDraft]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleApply = () => {
    const parsed = parsePriceList(draft, tickers);
    const count = Object.keys(parsed.prices).length;
    if (count === 0) {
      setFeedback('No valid prices found. Use one “TICKER, PRICE” pair per line, e.g. FFC, 571.30.');
      return;
    }
    onApply(parsed.prices, parsed.removed);
    const parts = [`Updated ${count} ${count === 1 ? 'price' : 'prices'}.`];
    if (parsed.removed.length > 0) {
      parts.push(`Cleared ${parsed.removed.length} ${parsed.removed.length === 1 ? 'price' : 'prices'}.`);
    }
    if (parsed.skipped > 0) parts.push(`${parsed.skipped} line${parsed.skipped === 1 ? '' : 's'} ignored.`);
    if (parsed.unknown.length > 0) parts.push(`Not in ${meta.label}: ${parsed.unknown.slice(0, 6).join(', ')}.`);
    setFeedback(parts.join(' '));
  };

  const handleReset = () => {
    onReset();
    setDraft(formatPriceList(tickers, snapshotPriceSet(index).prices));
    setFeedback('Restored the bundled price snapshot.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="price-dialog-title"
        className="relative flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-ink-200 bg-white shadow-pop animate-fade-in dark:border-ink-800 dark:bg-ink-900 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4 dark:border-ink-800">
          <div>
            <h2 id="price-dialog-title" className="text-base font-semibold tracking-tight text-ink-900 dark:text-white">
              Share prices · {meta.label}
            </h2>
            <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
              Used only to convert each allocation into whole shares. Nothing leaves your browser.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close price dialog"
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-ink-200 bg-ink-50/70 px-3 py-2 text-[11px] leading-relaxed text-ink-600 dark:border-ink-800 dark:bg-ink-950/40 dark:text-ink-300">
            <p className="font-semibold text-ink-800 dark:text-ink-100">{priceSetLabel(priceSet)}</p>
            <p>
              Snapshot captured {formatTimestamp(priceSet.updatedAt)}. Prices move constantly — replace them with your
              broker&apos;s current quotes before acting on the plan.
            </p>
          </div>

          <div>
            <label
              htmlFor="price-list"
              className="block text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500"
            >
              Price list
            </label>
            <p className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">
              One company per line: <span className="font-mono">TICKER, PRICE</span>. Companies you leave blank stay
              unpriced and their allocation is reported as uninvested.
            </p>
            <textarea
              id="price-list"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              spellCheck={false}
              rows={11}
              className="mt-2 w-full resize-y rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-800 shadow-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-100"
            />
          </div>

          {feedback ? (
            <p
              className={cn(
                'flex items-start gap-1.5 rounded-lg border px-3 py-2 text-[11px] leading-relaxed',
                feedback.startsWith('No valid')
                  ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200'
                  : 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200',
              )}
            >
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {feedback}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-200 px-5 py-3 dark:border-ink-800">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset to snapshot
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:bg-ink-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              Apply prices
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
