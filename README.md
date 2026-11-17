# PSXEdge

**Smarter Allocation. Simpler Investing.**

PSXEdge is a lightweight, fully client-side investment allocation calculator for the Pakistan Stock Exchange's
**KSE-100** and **KMI-30** indices. Pick an index, enter a budget in PKR, tune the weighting multiplier, and see the
allocation per company instantly. Export the whole plan to a professionally formatted Excel workbook — no backend, no
accounts, no servers.

- **React 19 + TypeScript + Vite**
- **Tailwind CSS** (light & dark themes)
- **Lucide React** icons
- **ExcelJS** for in-browser `.xlsx` generation (lazy-loaded)
- **localStorage** for preferences and the last validated dataset
- Deploys as a static site on **Vercel** (free tier)

---

## Quick start

```bash
git clone https://github.com/ShahzaibAhmedKhan31/PSXEdge.git
cd PSXEdge
npm install
npm run dev      # http://localhost:5173
```

| Command           | What it does                                     |
| ----------------- | ------------------------------------------------ |
| `npm run dev`     | Start the Vite dev server with hot reload        |
| `npm run build`   | Type-check (`tsc -b`) and build to `dist/`       |
| `npm run preview` | Serve the production build locally               |
| `npm test`        | Run the Vitest suite (calculator, validation, …) |
| `npm run typecheck` | Type-check without emitting                    |

Node 20.19+ or 22.12+ is recommended (Vite 7 requirement).

---

## How the calculator works

For each of the top-weighted companies:

```
Adjusted weightage = Original index weightage × Multiplier
Investment (PKR)   = Total investment × (Adjusted weightage ÷ 100)
```

- **KSE-100:** top **20** companies by index weightage, default multiplier **1.5**.
- **KMI-30:** top **15** companies by index weightage, default multiplier **1.1**.
- Rows are always sorted by **original** weightage, descending.
- Adjusted weightages are **never normalised** to 100%. The multiplier and budget are never silently changed.
- The dashboard shows the budget, total adjusted weightage, total allocated and remaining cash, plus an over-allocation
  warning when adjusted weights exceed 100%.
- All maths keeps full precision. Monetary values are rounded to whole rupees **only for display and export**, so the
  table, summary cards and workbook always agree (totals are the sum of the rounded row amounts).
- Inputs update results instantly via React state and a memoised `useInvestmentCalculator` hook. There is no "Calculate"
  button.

---

## Data sources, freshness and CORS (important)

PSX publishes index constituents and weightages on its Data Portal:

- KSE-100: <https://dps.psx.com.pk/indices/KSE100>
- KMI-30: <https://dps.psx.com.pk/indices/KMI30>

Those pages are server-rendered HTML and the upstream JSON routes (for example
`dps.psx.com.pk/timeseries/...`) **do not send `Access-Control-Allow-Origin` headers**. A normal browser therefore
cannot read them, and PSXEdge deliberately does **not** bypass CORS with a proxy, scraper or backend. Instead it ships a
clearly labelled snapshot and gives you two ways to refresh it.

### 1. Bundled snapshot (used by default)

The app ships real constituent snapshots captured from the official PSX Data Portal on **17 November 2026**, with
ticker, company name, sector and the published `IDX WTG (%)`. They are marked **“Bundled snapshot · Not live”** in the
UI and in every Excel export. They are not fabricated values, and they are not live prices either.

The bundled files live in:

- `src/data/sampleKSE100.ts` (100 constituents)
- `src/data/sampleKMI30.ts` (30 constituents)

### 2. Manual import (works everywhere)

Open **Import data** in the Data panel and drop a `.csv`, `.tsv`, `.xlsx` or `.xlsm` file. Everything is parsed in the
browser with ExcelJS / a built-in CSV parser — the file never leaves the device.

Required columns (headers are matched flexibly, case-insensitive):

| Ticker   | Company Name | Sector    | Weightage |
| -------- | ------------ | --------- | --------- |
| FFC      | Fauji Fertilizer Company Limited | Fertilizer | 9.13 |

- Header aliases such as `Symbol`, `Name`, `Industry`, `IDX WTG (%)`, `Index Weight` are recognised.
- Headerless files are accepted with the column order above.
- Values like `9.13%` and `1,234` are parsed; missing sectors become `Unclassified`.
- The importer validates rows, drops duplicates and invalid weights, sorts descending, then selects the **top 20**
  (KSE-100) or **top 15** (KMI-30). Imports with fewer than the required number of valid companies are rejected.
- Choose which index the file belongs to before confirming. A one-click CSV template is available in the dialog.

### 3. Refresh button / CORS-enabled feed

**Refresh** first tries a feed URL you configure under *Advanced* in the import dialog, then the official PSX page. If
both fail (the PSX one normally will, because of CORS), the last validated dataset stays in place, the attempt log is
shown, and nothing is overwritten.

A custom feed must be a CORS-enabled JSON endpoint you control (a static file on GitHub Pages works well):

```json
{
  "constituents": [
    { "ticker": "FFC", "companyName": "Fauji Fertilizer Company Limited", "sector": "Fertilizer", "weightage": 9.13 }
  ]
}
```

A plain array of those objects is also accepted.

### Caching and staleness

- The last successfully validated dataset per index is stored in `localStorage` and loaded instantly on the next visit.
- Cached data is only replaced after a successful fetch/import that passes validation.
- The Data panel shows the source, origin badge and retrieval timestamp.
- After **7 days** the dataset is flagged as stale and a warning banner appears; the app still uses it rather than
  inventing numbers. A refresh is attempted at most once every 6 hours, and only when the dataset is stale.
- **Use bundled** reverts an imported/cached dataset to the shipped snapshot.

---

## Excel export

The **Export to Excel** button generates the workbook entirely in the browser with ExcelJS (loaded on demand, so it
does not affect first load). File names:

```
PSXEdge_KSE100_Investment_Breakdown_2026-11-17.xlsx
PSXEdge_KMI30_Investment_Breakdown_2026-11-17.xlsx
```

**Worksheet 1 — Investment Summary:** application name, selected index, strategy, data source, retrieval date, dataset
type, company count, investment amount, multiplier, total adjusted weightage, total allocated, remaining cash (or the
over-allocation amount), and a generation note.

**Worksheet 2 — Company Breakdown:** rank, ticker, company name, sector, original weightage, multiplier, adjusted
weightage and investment amount (PKR), with bold header, borders, zebra fill, frozen header row, filters, currency and
percentage number formats, a totals row and page setup for printing.

The export always reflects the values currently on screen.

---

## Project structure

```
src/
├── components/
│   ├── DataImport/DataImportDialog.tsx   # CSV/XLSX import + feed URL + validation preview
│   ├── DataRefresh/DataStatus.tsx        # source, timestamp, staleness, refresh/import actions
│   ├── ExportButton/ExportButton.tsx
│   ├── Header/Header.tsx                 # brand, index toggle, theme, refresh, export
│   ├── IndexSelector/IndexSelector.tsx
│   ├── InvestmentInput/InvestmentInput.tsx
│   ├── InvestmentSummary/{InvestmentSummary,OverAllocationAlert}.tsx
│   ├── InvestmentTable/InvestmentTable.tsx
│   ├── MultiplierInput/MultiplierInput.tsx
│   ├── ThemeToggle/ThemeToggle.tsx
│   └── Toast/Toast.tsx
├── data/                                 # index metadata + labelled PSX snapshots
├── hooks/                                # useIndexData, useInvestmentCalculator, useTheme
├── lib/                                  # localStorage wrapper, class-name helper
├── pages/Dashboard/Dashboard.tsx
├── services/
│   ├── indexDataService.ts               # bundled/cached datasets, refresh attempts, PSX HTML parser
│   ├── investmentCalculator.ts           # pure calculation engine
│   ├── importService.ts                  # browser CSV/XLSX reading
│   └── excelExportService.ts             # ExcelJS workbook
├── types/
└── utils/                                # formatters, data validator, CSV parser
```

State stays local: a few hooks plus React state in the dashboard. No Redux, no router, no API layer.

---

## Themes and responsiveness

- Light and dark themes; system preference is respected on first visit and the choice is saved in `localStorage`.
- The theme is applied before first paint (inline script in `index.html`) to avoid a flash.
- Layouts for desktop, laptop, tablet and mobile. The allocation table scrolls horizontally inside its card on small
  screens without making the page overflow.

---

## Tests

```bash
npm test
```

The Vitest suite (71 assertions across 6 files) covers the calculator, validation and import logic, formatters, the CSV
parser and the Excel workbook (including a serialisation round-trip):

1. KSE-100 default multiplier is 1.5, KMI-30 is 1.1
2. Exactly 20 KSE-100 / 15 KMI-30 companies, descending weightage
3. Allocation maths (`12% × 1.1 = 13.2%`, Rs 100,000 → Rs 13,200)
4. No normalisation; correct remaining cash and over-allocation
5. Display rounding totals equal the sum of the table rows
6. Weightage parsing, ticker clean-up, duplicate handling, insufficient-data rejection
7. CSV quoted fields, CRLF, delimiters; PSX-style `IDX WTG (%)` column detection
8. Excel worksheet names, summary values, row counts, number formats, filters, totals row

Manual checks that complement the suite: instant updates while typing, index switching, dark-mode persistence, import
of a real PSX file, cached-dataset recovery after reload, and responsive layout.

---

## Deploying to Vercel

The repository already includes a `vercel.json` with the Vite preset, build command and SPA rewrite.

**Dashboard:** push to GitHub → *Add New… → Project* → import the repository → framework preset **Vite** →
build command `npm run build` → output directory `dist` → **Deploy**. No environment variables, no backend.

**CLI:**

```bash
npm i -g vercel
vercel        # preview deployment
vercel --prod # production deployment
```

The result is a static site; every calculation runs in the visitor's browser.

---

## Limitations & disclaimer

- Index weightages change continuously with prices and periodic recompositions. A snapshot — bundled, imported or
  fetched — is a point-in-time view. Verify current data at [psx.com.pk](https://www.psx.com.pk) before trading.
- The PSX endpoints are undocumented and may change; the parser is defensive and reports failures rather than guessing.
- Company sector labels follow PSX sector classifications for the bundled snapshot; imported files keep their own sector
  values (or `Unclassified`).
- PSXEdge is an educational allocation tool. It is not investment advice, not a broker, and is not affiliated with the
  Pakistan Stock Exchange.

MIT licensed. Built to stay small, fast and entirely client-side.
