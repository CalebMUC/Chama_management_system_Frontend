import { describe, expect, it } from 'vitest';
import { csvMoney, toCsv } from './csv';

describe('toCsv', () => {
  it('quotes commas, quotes and newlines', () => {
    const csv = toCsv([{ a: 'x, y', b: 'say "hi"', c: 'two\nlines' }], [
      { header: 'A', value: (r) => r.a },
      { header: 'B', value: (r) => r.b },
      { header: 'C', value: (r) => r.c },
    ]);
    expect(csv).toBe('A,B,C\r\n"x, y","say ""hi""","two\nlines"');
  });

  it('neutralises spreadsheet formulas but keeps negative numbers', () => {
    const csv = toCsv([{ v: '=SUM(A1)' }, { v: '-150.5' }, { v: '@cmd' }], [{ header: 'V', value: (r) => r.v }]);
    expect(csv.split('\r\n')).toEqual(['V', "'=SUM(A1)", '-150.5', "'@cmd"]);
  });

  it('writes empty cells for null and undefined', () => {
    expect(toCsv([{ v: null }], [{ header: 'V', value: (r) => r.v }])).toBe('V\r\n');
  });
});

describe('csvMoney', () => {
  it('turns minor units into a plain decimal', () => {
    expect(csvMoney(150050)).toBe(1500.5);
    expect(csvMoney(5000, 0)).toBe(5000);
    expect(csvMoney(null)).toBe('');
  });
});
