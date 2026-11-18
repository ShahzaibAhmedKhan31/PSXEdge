import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ListFilter, Search } from 'lucide-react';
import { cn } from '../../lib/cn';
import { toggleExcluded } from '../../services/investmentCalculator';
import type { RankedConstituent } from '../../types/investment';
import { formatPercent } from '../../utils/percentageFormatter';

interface CompanyFilterPopoverProps {
  /** Companies matching the shortlist / sector / search filters, before the checklist. */
  companies: readonly RankedConstituent[];
  /** Tickers the user has unchecked. */
  excluded: readonly string[];
  /** Companies actually shown in the table (candidates minus excluded). */
  visibleCount: number;
  onChange: (excluded: string[]) => void;
}

/** Excel-style checklist: unchecking a company removes it and rebalances the rest. */
export function CompanyFilterPopover({
  companies,
  excluded,
  visibleCount,
  onChange,
}: CompanyFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const excludedSet = useMemo(
    () => new Set(excluded.map((ticker) => ticker.trim().toUpperCase())),
    [excluded],
  );
  const candidateTickers = useMemo(() => companies.map((company) => company.ticker.toUpperCase()), [companies]);
  const listed = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter(
      (company) =>
        company.ticker.toLowerCase().includes(term) || company.companyName.toLowerCase().includes(term),
    );
  }, [companies, query]);

  const includedCount = candidateTickers.filter((ticker) => !excludedSet.has(ticker)).length;
  const excludedCount = excluded.length;

  // Keep the fixed-position panel anchored to its button while scrolling/resizing.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 24);
      const left = Math.min(Math.max(12, rect.right - width), Math.max(12, window.innerWidth - width - 12));
      setPosition({ top: rect.bottom + 6, left, width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = (ticker: string) => onChange(toggleExcluded(excluded, ticker));

  const includeAllCandidates = () =>
    onChange(excluded.filter((ticker) => !candidateTickers.includes(ticker.trim().toUpperCase())));

  const excludeAllCandidates = () => {
    const next = new Set(excluded.map((ticker) => ticker.trim().toUpperCase()));
    candidateTickers.forEach((ticker) => next.add(ticker));
    onChange([...next]);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setQuery('');
          setOpen((current) => !current);
        }}
        className={cn(
          'inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
          excludedCount > 0
            ? 'border-brand-600/30 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300'
            : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
        )}
      >
        <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
        Companies
        <span
          className={cn(
            'rounded px-1 text-[10px] font-semibold tabular-nums',
            excludedCount > 0
              ? 'bg-brand-600/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300'
              : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400',
          )}
        >
          {visibleCount}/{companies.length}
        </span>
        <ChevronDown
          className={cn('h-3 w-3 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Company filter"
              style={{ position: 'fixed', top: position.top, left: position.left, width: position.width }}
              className="z-50 flex max-h-[min(70vh,420px)] flex-col overflow-hidden rounded-lg border border-ink-200 bg-white shadow-pop animate-fade-in dark:border-ink-700 dark:bg-ink-900"
            >
              <div className="flex items-center justify-between gap-2 border-b border-ink-200 px-3 py-2 dark:border-ink-800">
                <p className="text-xs font-semibold text-ink-900 dark:text-white">Include companies</p>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={includeAllCandidates}
                    className="rounded px-1.5 py-0.5 font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
                  >
                    All
                  </button>
                  <span className="text-ink-300 dark:text-ink-600" aria-hidden="true">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={excludeAllCandidates}
                    className="rounded px-1.5 py-0.5 font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white"
                  >
                    None
                  </button>
                </div>
              </div>

              <div className="relative px-3 py-2">
                <label htmlFor="company-filter-search" className="sr-only">
                  Find a company
                </label>
                <Search
                  className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
                  aria-hidden="true"
                />
                <input
                  id="company-filter-search"
                  type="text"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Find ticker or company"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-8 w-full rounded-md border border-ink-200 bg-white pl-7 pr-2 text-xs text-ink-900 shadow-sm outline-none transition-colors placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-950 dark:text-white dark:placeholder:text-ink-500"
                />
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
                {listed.length === 0 ? (
                  <p className="px-2 py-4 text-center text-[11px] text-ink-500 dark:text-ink-400">
                    No companies match this selection.
                  </p>
                ) : (
                  listed.map((company) => {
                    const checked = !excludedSet.has(company.ticker.toUpperCase());
                    return (
                      <label
                        key={company.ticker}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 transition-colors hover:bg-ink-50 dark:hover:bg-ink-800/70"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(company.ticker)}
                          className="h-3.5 w-3.5 shrink-0 accent-brand-600"
                        />
                        <span className="shrink-0 font-mono text-[11px] font-semibold text-ink-700 dark:text-ink-200">
                          {company.ticker}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[11px] text-ink-600 dark:text-ink-300">
                          {company.companyName}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-ink-400 dark:text-ink-500">
                          {formatPercent(company.weightage)}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-ink-200 px-3 py-2 dark:border-ink-800">
                <span className="text-[11px] text-ink-500 dark:text-ink-400">
                  {includedCount} of {companies.length} included
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                >
                  Done
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
