/**
 * Tiny dependency-free delimited-text parser.
 * Handles quoted fields, escaped quotes (""), CRLF/LF, and a UTF-8 BOM.
 */

const DELIMITERS = [',', ';', '\t', '|'] as const;

/** Guess the delimiter by counting candidates in the first non-empty line. */
export function detectDelimiter(text: string): string {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/).find((line) => line.trim().length > 0) ?? '';
  let best = ',';
  let bestCount = -1;
  for (const delimiter of DELIMITERS) {
    // Ignore delimiters inside quotes for a slightly better guess.
    const count = firstLine.replace(/"[^"]*"/g, '').split(delimiter).length - 1;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/** Parse delimited text into a matrix of trimmed cell strings. */
export function parseDelimited(text: string, delimiter?: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const sep = delimiter ?? detectDelimiter(input);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === sep) {
      row.push(field.trim());
      field = '';
    } else if (char === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      // Skip; \r\n handled by the \n branch.
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.length > 0));
}
