import { describe, expect, it } from 'vitest';
import { detectDelimiter, parseDelimited } from './csvParser';

describe('detectDelimiter', () => {
  it('detects commas, semicolons and tabs', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });

  it('ignores delimiters inside quoted fields', () => {
    // The commas live inside a quoted field, so the semicolon wins.
    expect(detectDelimiter('"A, B, C";x\n1;2')).toBe(';');
  });
});

describe('parseDelimited', () => {
  it('parses simple CSV', () => {
    expect(parseDelimited('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles quoted fields containing delimiters and newlines', () => {
    const rows = parseDelimited('Ticker,Company,Sector,Weightage\nFFC,"Fauji Fertilizer, Limited",Fertilizer,9.13');
    expect(rows[1]).toEqual(['FFC', 'Fauji Fertilizer, Limited', 'Fertilizer', '9.13']);
  });

  it('handles escaped quotes', () => {
    const rows = parseDelimited('a,b\n"say ""hi""",2');
    expect(rows[1]).toEqual(['say "hi"', '2']);
  });

  it('handles CRLF, BOM and blank lines', () => {
    const text = '\uFEFFTicker;Weightage\r\nFFC;9.13\r\n\r\nUBL;7.75\r\n';
    expect(parseDelimited(text)).toEqual([
      ['Ticker', 'Weightage'],
      ['FFC', '9.13'],
      ['UBL', '7.75'],
    ]);
  });

  it('keeps trailing empty cells out of the row count but trims fields', () => {
    const rows = parseDelimited('  a , b ,, \n');
    expect(rows).toHaveLength(1);
    expect(rows[0].slice(0, 2)).toEqual(['a', 'b']);
  });
});
