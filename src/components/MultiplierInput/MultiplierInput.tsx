import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatMultiplier, formatPercent } from '../../utils/percentageFormatter';

const MIN_MULTIPLIER = 0.1;
const MAX_MULTIPLIER = 20;
const SLIDER_MIN = 0.5;
const SLIDER_MAX = 3;

export interface MultiplierExample {
  ticker: string;
  originalWeightage: number;
  adjustedWeightage: number;
}

interface MultiplierInputProps {
  value: number;
  defaultValue: number;
  onChange: (value: number) => void;
  example?: MultiplierExample;
}

function clamp(value: number): number {
  return Math.min(Math.max(value, MIN_MULTIPLIER), MAX_MULTIPLIER);
}

export function MultiplierInput({ value, defaultValue, onChange, example }: MultiplierInputProps) {
  const [text, setText] = useState(() => value.toFixed(2));
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(value.toFixed(2));
    }
  }, [value]);

  const handleTextChange = (raw: string) => {
    setText(raw);
    const parsed = Number(raw);
    if (raw.trim() !== '' && Number.isFinite(parsed) && parsed > 0) {
      const next = clamp(parsed);
      lastEmitted.current = next;
      onChange(next);
    }
  };

  const handleBlur = () => {
    setText(value.toFixed(2));
  };

  const isDefault = Math.abs(value - defaultValue) < 0.0001;

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <label htmlFor="multiplier-input" className="text-sm font-semibold text-ink-900 dark:text-white">
            Weighting multiplier
          </label>
          <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">
            Adjusted weight = original weight × multiplier.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            lastEmitted.current = defaultValue;
            onChange(defaultValue);
            setText(defaultValue.toFixed(2));
          }}
          disabled={isDefault}
          className="inline-flex items-center gap-1 rounded-md border border-ink-200 px-2 py-1 text-[11px] font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-700 disabled:cursor-default disabled:opacity-40 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-800"
          title={`Reset to the ${defaultValue.toFixed(2)}× default`}
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Reset
        </button>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="relative flex-1">
          <input
            id="multiplier-input"
            name="multiplier"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={text}
            onChange={(event) => handleTextChange(event.target.value)}
            onBlur={handleBlur}
            className="h-12 w-full rounded-lg border border-ink-200 bg-white px-3 pr-9 text-lg font-semibold tracking-tight tabular-nums text-ink-900 shadow-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-950 dark:text-white"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-400"
          >
            ×
          </span>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-medium uppercase tracking-wider text-ink-400 dark:text-ink-500">
            Current
          </div>
          <div className="text-sm font-semibold tabular-nums text-ink-700 dark:text-ink-200">
            {formatMultiplier(value)}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <input
          type="range"
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          step={0.05}
          value={Math.min(Math.max(value, SLIDER_MIN), SLIDER_MAX)}
          onChange={(event) => {
            const next = Number(event.target.value);
            lastEmitted.current = next;
            onChange(next);
            setText(next.toFixed(2));
          }}
          aria-label="Multiplier slider"
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-brand-600 dark:bg-ink-800"
        />
        <div className="mt-1 flex justify-between text-[10px] tabular-nums text-ink-400 dark:text-ink-500">
          <span>{SLIDER_MIN.toFixed(2)}×</span>
          <span className="font-medium text-ink-500 dark:text-ink-400">Default {defaultValue.toFixed(2)}×</span>
          <span>{SLIDER_MAX.toFixed(2)}×</span>
        </div>
      </div>

      {example ? (
        <p className="mt-3 border-t border-ink-100 pt-2.5 text-[11px] text-ink-500 dark:border-ink-800 dark:text-ink-400">
          Example: <span className="font-semibold text-ink-700 dark:text-ink-200">{example.ticker}</span>{' '}
          <span className={cn('tabular-nums', 'line-through decoration-ink-300 dark:decoration-ink-600')}>
            {formatPercent(example.originalWeightage)}
          </span>{' '}
          →{' '}
          <span className="font-semibold tabular-nums text-brand-700 dark:text-brand-400">
            {formatPercent(example.adjustedWeightage)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
