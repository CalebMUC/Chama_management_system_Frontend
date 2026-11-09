import { describe, expect, it } from 'vitest';
import {
  addDays, compactFigure, daysBetween, dueIn, formatInstant, formatInstantDate, formatTime, endOfDayNairobiInstant, formatBp, formatCompactMoney, formatDate, formatFigure, formatMoney, formatPeriodKey,
  fractionDigits, humanize, maskIdentifier, memberLabel, minorToInput, parseMoney, parsePercentToBp,
} from './format';

describe('money', () => {
  it('adds without floating-point error (README §15)', () => {
    expect(parseMoney('0.1') + parseMoney('0.2')).toBe(30);
  });

  it('parses commas, spaces and a currency prefix', () => {
    expect(parseMoney('1,500.5')).toBe(150050);
    expect(parseMoney(' 1 500 ')).toBe(150000);
    expect(parseMoney('KES 2,000.05')).toBe(200005);
  });

  it('rejects bad input and too many decimals', () => {
    expect(() => parseMoney('abc')).toThrow();
    expect(() => parseMoney('-5')).toThrow();
    expect(() => parseMoney('1.234')).toThrow('At most 2 decimal places');
    expect(() => parseMoney('10.5', 'UGX')).toThrow('Whole amounts only');
  });

  it('respects each currency\'s decimals', () => {
    expect(fractionDigits('KES')).toBe(2);
    expect(fractionDigits('UGX')).toBe(0);
    expect(parseMoney('5000', 'UGX')).toBe(5000);
  });

  it('formats minor units and round-trips through the input form', () => {
    expect(formatMoney(150050, 'KES')).toMatch(/1,500\.50/);
    expect(formatMoney(null)).toBe('—');
    expect(minorToInput(150050)).toBe('1500.5');
    expect(minorToInput(500000)).toBe('5000');
    expect(minorToInput(-150005)).toBe('-1500.05');
    expect(parseMoney(minorToInput(123456))).toBe(123456);
  });
});

describe('money display', () => {
  const nb = ' ';
  it('shows the ISO code, a no-break space and a true minus sign', () => {
    expect(formatMoney(150050, 'KES')).toBe(`KES${nb}1,500.50`);
    expect(formatMoney(-150050, 'KES')).toBe(`−KES${nb}1,500.50`);
    expect(formatMoney(500000, 'UGX')).toBe(`UGX${nb}500,000`);
    expect(formatMoney(150050, 'KES', { symbol: false })).toBe('1,500.50');
  });

  it('gives the bare figure for table cells', () => {
    expect(formatFigure(-209945000)).toBe('2,099,450.00');
    expect(formatFigure(0)).toBe('0.00');
  });

  it('compacts large KPI figures', () => {
    expect(formatCompactMoney(209_945_000, 'KES')).toBe(`KES${nb}2.10M`);
    expect(formatCompactMoney(356_020_000, 'KES')).toBe(`KES${nb}3.56M`);
    expect(formatCompactMoney(95_012_500, 'KES')).toBe(`KES${nb}950.1K`);
    expect(formatCompactMoney(125_000_000_000, 'KES')).toBe(`KES${nb}1.25B`);
    expect(formatCompactMoney(-128_450_000, 'KES')).toBe(`−KES${nb}1.28M`);
    expect(formatCompactMoney(null)).toBe('—');
  });

  it('keeps small amounts exact', () => {
    expect(formatCompactMoney(925_000, 'KES')).toBe(`KES${nb}9,250.00`);
    expect(formatCompactMoney(9_999_999, 'KES')).toBe(`KES${nb}99,999.99`);
    expect(formatCompactMoney(5_000, 'UGX')).toBe(`UGX${nb}5,000`);
  });

  it('promotes at unit boundaries instead of showing 1000.0K', () => {
    expect(compactFigure(999_999.6)).toBe('1.00M');
    expect(compactFigure(999_949)).toBe('999.9K');
    expect(compactFigure(100_000)).toBe('100.0K');
    expect(compactFigure(1_000_000)).toBe('1.00M');
    expect(compactFigure(42)).toBe('42');
  });

  it('masks identifiers to their last four characters', () => {
    expect(maskIdentifier('UMJ-DEP-000007')).toBe(`••••${nb}0007`);
    expect(maskIdentifier(null)).toBe('—');
  });
});

describe('rates', () => {
  it('converts basis points both ways', () => {
    expect(formatBp(1250)).toBe('12.5%');
    expect(parsePercentToBp('12.5')).toBe(1250);
  });
});

describe('business dates', () => {
  it('formats a day without a time-zone shift', () => {
    expect(formatDate('2026-11-08')).toBe('08 Nov 2026');
    expect(formatDate('2026-01-01')).toBe('01 Jan 2026');
    expect(formatDate('2026-09-30')).toBe('30 Sep 2026');
    expect(formatDate(null)).toBe('—');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('turns a licence day into the end of that day in Nairobi (README §7.16)', () => {
    expect(endOfDayNairobiInstant('2027-12-31')).toBe('2027-12-31T20:59:59Z');
  });

  it('formats period keys', () => {
    expect(formatPeriodKey('2026-11')).toBe('Nov 2026');
    expect(formatPeriodKey('2026-W45')).toBe('Week 45, 2026');
  });
});

describe('labels', () => {
  it('humanises codes', () => {
    expect(humanize('LOAN_APPROVAL_GIVEN')).toBe('Loan approval given');
  });
  it('shows members by number and name, never an id', () => {
    expect(memberLabel('Jane Wanjiku', 12)).toBe('#12 Jane Wanjiku');
    expect(memberLabel(null, null)).toBe('Unknown member');
  });
});

describe('instants', () => {
  it('shows local dates and 24-hour times in the one format', () => {
    const local = new Date(2026, 8, 4, 18, 5).toISOString();
    expect(formatInstant(local)).toBe('04 Sep 2026, 18:05');
    expect(formatInstantDate(local)).toBe('04 Sep 2026');
    expect(formatTime(local)).toBe('18:05');
    expect(formatInstant(undefined)).toBe('—');
    expect(formatInstant('not a date')).toBe('not a date');
  });
});

describe('due dates', () => {
  it('counts whole days between business dates', () => {
    expect(daysBetween('2026-11-09', '2026-11-30')).toBe(21);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-11-09', '2026-11-01')).toBe(-8);
  });

  it('describes how far away a due date is', () => {
    expect(dueIn('2026-11-30', '2026-11-09')).toBe('in 21 days');
    expect(dueIn('2026-11-10', '2026-11-09')).toBe('due tomorrow');
    expect(dueIn('2026-11-09', '2026-11-09')).toBe('due today');
    expect(dueIn('2026-11-08', '2026-11-09')).toBe('1 day overdue');
    expect(dueIn('2026-11-01', '2026-11-09')).toBe('8 days overdue');
  });
});
