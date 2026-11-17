import { cn } from '../../lib/cn';
import { formatAmountInput, formatCompactPKR, formatPKR } from '../../utils/currencyFormatter';

const PRESETS = [50_000, 100_000, 500_000, 1_000_000, 5_000_000] as const;

interface InvestmentInputProps {
  rawValue: string;
  onChange: (raw: string) => void;
  error?: string | null;
}

export function InvestmentInput({ rawValue, onChange, error }: InvestmentInputProps) {
  const amount = Number(rawValue || 0);
  const display = formatAmountInput(rawValue);

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label htmlFor="investment-amount" className="text-sm font-semibold text-ink-900 dark:text-white">
            Total investment amount
          </label>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">Enter any amount in Pakistani Rupees.</p>
        </div>
        <span className="rounded-md border border-ink-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500 dark:border-ink-700 dark:text-ink-400">
          PKR
        </span>
      </div>

      <div className="relative mt-3">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-400"
        >
          Rs
        </span>
        <input
          id="investment-amount"
          name="investment-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0"
          value={display}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'investment-amount-error' : undefined}
          className={cn(
            'h-12 w-full rounded-lg border bg-white pl-9 pr-3 text-lg font-semibold tracking-tight tabular-nums text-ink-900 shadow-sm outline-none transition-colors placeholder:font-normal placeholder:text-ink-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:bg-ink-950 dark:text-white dark:placeholder:text-ink-600',
            error
              ? 'border-red-300 dark:border-red-500/50'
              : 'border-ink-200 dark:border-ink-700',
          )}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => {
          const active = amount === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(String(preset))}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
                active
                  ? 'border-brand-600/30 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800',
              )}
            >
              {formatCompactPKR(preset)}
            </button>
          );
        })}
        <span className="ml-auto hidden text-[11px] text-ink-400 dark:text-ink-500 sm:block">
          {amount > 0 ? formatPKR(amount) : 'No budget set'}
        </span>
      </div>

      {error ? (
        <p id="investment-amount-error" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
