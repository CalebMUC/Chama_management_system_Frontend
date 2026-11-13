import { describe, expect, it } from 'vitest';
import type { MonthTrend } from '@/api/types';
import { complianceTone } from './Ranked';
import { monthLabel, trendSeries } from './TrendChart';

const month = (m: string, over: Partial<MonthTrend> = {}): MonthTrend => ({
  month: m,
  contributionsMinor: 0,
  contributionPayments: 0,
  loansDisbursedMinor: 0,
  incomeMinor: 0,
  expensesMinor: 0,
  surplusMinor: 0,
  ...over,
});

describe('trendSeries', () => {
  it('keeps every series when all features are licensed', () => {
    expect(trendSeries([month('2026-10'), month('2026-11')]).map((s) => s.name)).toEqual(['Contributions', 'Loans disbursed', 'Income', 'Expenses']);
  });

  it('drops a series whose field is null (unlicensed), keeping the others in their fixed order and colour slot', () => {
    const series = trendSeries([month('2026-11', { loansDisbursedMinor: null })]);
    expect(series.map((s) => s.name)).toEqual(['Contributions', 'Income', 'Expenses']);
    // Colour follows the entity, not its position: income stays on slot 2 with loans gone.
    expect(series.find((s) => s.name === 'Income')?.slot).toBe(2);
  });

  it('always keeps income and expenses', () => {
    const series = trendSeries([month('2026-11', { contributionsMinor: null, contributionPayments: null, loansDisbursedMinor: null })]);
    expect(series.map((s) => s.name)).toEqual(['Income', 'Expenses']);
  });
});

describe('monthLabel', () => {
  it('formats "YYYY-MM" and marks the partial month', () => {
    expect(monthLabel('2026-11', false)).toBe('Nov 2026');
    expect(monthLabel('2026-11', true)).toBe('Nov 2026 (to date)');
  });
});

describe('complianceTone', () => {
  it('is green at 90% and above, amber from 70% to 89%, red under 70%', () => {
    expect(complianceTone(10_000)).toBe('success');
    expect(complianceTone(9_000)).toBe('success');
    expect(complianceTone(8_999)).toBe('warning');
    expect(complianceTone(7_000)).toBe('warning');
    expect(complianceTone(6_999)).toBe('destructive');
  });
});
