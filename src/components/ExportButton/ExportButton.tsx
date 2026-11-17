import { FileSpreadsheet, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  onClick: () => void;
  exporting: boolean;
  disabled?: boolean;
}

export function ExportButton({ onClick, exporting, disabled }: ExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || exporting}
      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-ink-950"
      aria-label="Export the current allocation to an Excel workbook"
    >
      {exporting ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
      )}
      <span className="hidden sm:inline">{exporting ? 'Preparing…' : 'Export to Excel'}</span>
      <span className="sm:hidden">{exporting ? '…' : 'Export'}</span>
    </button>
  );
}
