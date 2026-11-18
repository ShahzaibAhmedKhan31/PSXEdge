import { RotateCcw, Search, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { AllocationFilter, RankedConstituent, TopNSelection } from '../../types/investment';
import { CompanyFilterPopover } from './CompanyFilterPopover';

const CANDIDATE_PRESETS = [10, 15, 20, 30, 50] as const;

interface AllocationFiltersProps {
  filter: AllocationFilter;
  onChange: (filter: AllocationFilter) => void;
  sectors: readonly string[];
  /** Whole index, ranked. */
  totalCount: number;
  /** Rows currently shown in the table. */
  visibleCount: number;
  /** Companies matching the shortlist/sector/search filters, before the checkbox filter. */
  companies: readonly RankedConstituent[];
}

function presetLabel(value: TopNSelection): string {
  return value === 'all' ? 'All' : `Top ${value}`;
}

/**
 * Shortlist (top-N) + drill-down (sector, company search) controls. Every change
 * immediately re-filters the list, which re-derives the multiplier.
 */
export function AllocationFilters({
  filter,
  onChange,
  sectors,
  totalCount,
  visibleCount,
  companies,
}: AllocationFiltersProps) {
  const presets: TopNSelection[] = [
    'all',
    ...CANDIDATE_PRESETS.filter((preset) => preset < totalCount),
  ];
  const excluded = filter.excluded ?? [];
  const isDefault =
    filter.topN === 'all' && filter.sector === 'all' && filter.search.trim() === '' && excluded.length === 0;

  const update = (patch: Partial<AllocationFilter>) => onChange({ ...filter, ...patch });

  return (
    <div className="border-b border-ink-200 px-4 py-3 dark:border-ink-800 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-ink-900 dark:text-white">
          Companies
          <span className="ml-2 rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-ink-500 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-400">
            {visibleCount} of {totalCount}
          </span>
        </h2>
        <p className="text-[11px] text-ink-500 dark:text-ink-400">
          {isDefault
            ? 'Showing every constituent'
            : excluded.length > 0
              ? `${excluded.length} ${excluded.length === 1 ? 'company' : 'companies'} unchecked · multiplier rebalanced`
              : 'Filters applied — multiplier rebalanced'}
        </p>
      </div>

      <div className="mt-2.5 flex flex-col gap-2 lg:flex-row lg:items-center">
        <div
          role="group"
          aria-label="Shortlist by weightage"
          className="flex flex-wrap items-center gap-1"
        >
          {presets.map((preset) => {
            const active = filter.topN === preset;
            return (
              <button
                key={String(preset)}
                type="button"
                aria-pressed={active}
                onClick={() => update({ topN: preset })}
                className={cn(
                  'rounded-md border px-2 py-1 text-[11px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                  active
                    ? 'border-brand-600/30 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300'
                    : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
                )}
              >
                {presetLabel(preset)}
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center lg:justify-end">
          <div className="relative flex-1 sm:max-w-[240px]">
            <label htmlFor="company-search" className="sr-only">
              Search ticker, company or sector
            </label>
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <input
              id="company-search"
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="Search company or ticker"
              value={filter.search}
              onChange={(event) => update({ search: event.target.value })}
              className="h-8 w-full rounded-md border border-ink-200 bg-white pl-7 pr-7 text-xs text-ink-900 shadow-sm outline-none transition-colors placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-950 dark:text-white dark:placeholder:text-ink-500"
            />
            {filter.search ? (
              <button
                type="button"
                onClick={() => update({ search: '' })}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-400 transition-colors hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:text-ink-200"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <label htmlFor="sector-filter" className="sr-only">
              Filter by sector
            </label>
            <select
              id="sector-filter"
              value={filter.sector}
              onChange={(event) => update({ sector: event.target.value })}
              className="h-8 max-w-[190px] rounded-md border border-ink-200 bg-white px-2 text-xs text-ink-700 shadow-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-950 dark:text-ink-200"
            >
              <option value="all">All sectors</option>
              {sectors.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>

            <CompanyFilterPopover
              companies={companies}
              excluded={excluded}
              visibleCount={visibleCount}
              onChange={(next) => update({ excluded: next })}
            />

            {!isDefault ? (
              <button
                type="button"
                onClick={() => onChange({ topN: 'all', sector: 'all', search: '', excluded: [] })}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-ink-200 bg-white px-2 text-[11px] font-medium text-ink-600 transition-colors hover:border-ink-300 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
