import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

interface PriceInputProps {
  ticker: string;
  /** Current price, or null when unpriced. */
  value: number | null;
  onCommit: (value: number | null) => void;
}

/**
 * Inline price editor. Keeps a local draft so typing decimals is smooth, and
 * commits on blur or Enter — which is when the share counts recalculate.
 */
export function PriceInput({ ticker, value, onCommit }: PriceInputProps) {
  const [draft, setDraft] = useState(value === null ? '' : value.toFixed(2));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value === null ? '' : value.toFixed(2));
  }, [value]);

  const commit = () => {
    const cleaned = draft.replace(/,/g, '').trim();
    if (cleaned === '') {
      if (value !== null) onCommit(null);
      return;
    }
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      // Invalid input: restore the last good price instead of guessing.
      setDraft(value === null ? '' : value.toFixed(2));
      return;
    }
    const rounded = Math.round(parsed * 100) / 100;
    setDraft(rounded.toFixed(2));
    if (rounded !== value) onCommit(rounded);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      aria-label={`Current price for ${ticker} in rupees`}
      placeholder="—"
      value={draft}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        // Commit valid prices as the user types so the share counts stay live.
        const parsed = Number(raw.replace(/,/g, '').trim());
        if (Number.isFinite(parsed) && parsed > 0) {
          const rounded = Math.round(parsed * 100) / 100;
          if (rounded !== value) onCommit(rounded);
        }
      }}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          setDraft(value === null ? '' : value.toFixed(2));
          event.currentTarget.blur();
        }
      }}
      className={cn(
        'h-7 w-24 rounded-md border border-transparent bg-transparent px-1.5 text-right text-xs tabular-nums text-ink-700 outline-none transition-colors',
        'hover:border-ink-200 hover:bg-white focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20',
        'dark:text-ink-200 dark:hover:border-ink-700 dark:hover:bg-ink-950 dark:focus:bg-ink-950',
        value === null && 'text-ink-400 dark:text-ink-500',
      )}
    />
  );
}
