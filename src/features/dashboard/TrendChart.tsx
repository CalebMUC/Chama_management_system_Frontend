'use client';

import { useState } from 'react';
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import type { MonthTrend } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { slotColor } from '@/components/shared/Charts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { compactFigure, formatMoney, formatPeriodKey, fractionDigits } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Segmented } from './Ranked';

// Kept apart from the dashboard pages' other pieces so only screens that draw the trend load Recharts.
// Hues follow a fixed entity order (palette slots in globals.css), so a series keeps its colour when another is dropped.

type SeriesKey = 'contributionsMinor' | 'loansDisbursedMinor' | 'incomeMinor' | 'expensesMinor';
interface Series {
  key: SeriesKey;
  name: string;
  slot: number;
  mark: 'bar' | 'line';
}
const SERIES: Series[] = [
  { key: 'contributionsMinor', name: 'Contributions', slot: 0, mark: 'bar' },
  { key: 'loansDisbursedMinor', name: 'Loans disbursed', slot: 1, mark: 'bar' },
  { key: 'incomeMinor', name: 'Income', slot: 2, mark: 'line' },
  { key: 'expensesMinor', name: 'Expenses', slot: 3, mark: 'line' },
];

/** Series whose field is null (an unlicensed feature) are dropped; income and expenses are always there. */
export function trendSeries(months: MonthTrend[]): Series[] {
  return SERIES.filter((s) => months.some((m) => m[s.key] !== null));
}

/** "2026-11" -> "Nov 2026", with "to date" on the last (current, partial) month. */
export const monthLabel = (month: string, partial: boolean) => `${formatPeriodKey(month)}${partial ? ' (to date)' : ''}`;

/**
 * The monthly trend (DASHBOARDS.md "Trends"): contributions and loans disbursed as bars, income and expenses as lines, surplus
 * in the tooltip and the table. One money axis. The last month is the current month to date: its bars are lighter and its label
 * says "to date". Every value is also in the table view, so the tooltip never gates a number.
 */
export function TrendChart({ months, currency, height = 260, defaultView = 'chart', tableToggle = true, dimmed }: {
  months: MonthTrend[];
  currency: string;
  height?: number;
  defaultView?: 'chart' | 'table';
  /** Off where the page already shows TrendTable beside the chart. */
  tableToggle?: boolean;
  /** Previous data held on screen while a refetch runs. */
  dimmed?: boolean;
}) {
  const [view, setView] = useState<'chart' | 'table'>(defaultView);
  const series = trendSeries(months);
  const scale = 10 ** fractionDigits(currency);
  const last = months.length - 1;
  const data = months.map((m, i) => ({ ...m, label: formatPeriodKey(m.month), partial: i === last }));
  const bars = series.filter((s) => s.mark === 'bar');
  const empty = months.every((m) => series.every((s) => !m[s.key]) && !m.surplusMinor);

  return (
    <div className={cn('space-y-2 transition-opacity', dimmed && 'opacity-60')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              {s.mark === 'bar'
                ? <span className="size-2.5 rounded-[2px]" style={{ background: slotColor(s.slot) }} aria-hidden />
                : <span className="h-0.5 w-3.5 rounded-full" style={{ background: slotColor(s.slot) }} aria-hidden />}
              {s.name}
            </li>
          ))}
        </ul>
        {tableToggle && <Segmented<'chart' | 'table'> value={view} onChange={setView} label="Trend view" options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} />}
      </div>

      {view === 'table' ? (
        <TrendTable months={months} currency={currency} />
      ) : empty ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No activity in these months yet.</p>
      ) : (
        <div
          style={{ height }}
          role="img"
          aria-label={`Monthly trend, ${monthLabel(months[0].month, false)} to ${monthLabel(months[last].month, true)}: ${series.map((s) => s.name.toLowerCase()).join(', ')}. The table view lists every value.`}
        >
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" minTickGap={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={52}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `${v < 0 ? '−' : ''}${compactFigure(Math.abs(v) / scale)}`}
              />
              <RTooltip cursor={{ fill: 'hsl(var(--muted) / 0.6)' }} content={({ active, payload }) => (active && payload?.length ? <TrendTooltip m={payload[0].payload} series={series} currency={currency} /> : null)} />
              {bars.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.name} fill={slotColor(s.slot)} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {data.map((d) => <Cell key={d.month} fillOpacity={d.partial ? 0.45 : 1} />)}
                </Bar>
              ))}
              {series.filter((s) => s.mark === 'line').map((s) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.name}
                  stroke={slotColor(s.slot)}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={false}
                  activeDot={{ r: 4, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {view === 'chart' && !empty && <p className="text-2xs text-muted-foreground">{formatPeriodKey(months[last].month)} is the month to date (lighter bars).</p>}
    </div>
  );
}

function TrendTooltip({ m, series, currency }: { m: MonthTrend & { partial: boolean }; series: Series[]; currency: string }) {
  const deficit = m.surplusMinor < 0;
  return (
    <div className="min-w-[13rem] rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1.5 font-semibold">{monthLabel(m.month, m.partial)}</p>
      <dl className="space-y-1">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className={s.mark === 'bar' ? 'size-2.5 rounded-[2px]' : 'h-0.5 w-3'} style={{ background: slotColor(s.slot) }} aria-hidden />
            <dt className="flex-1 text-muted-foreground">
              {s.name}
              {s.key === 'contributionsMinor' && m.contributionPayments !== null && ` · ${m.contributionPayments} payment${m.contributionPayments === 1 ? '' : 's'}`}
            </dt>
            <dd className="tabular">{formatMoney(m[s.key], currency)}</dd>
          </div>
        ))}
        <div className="flex items-center gap-2 border-t pt-1 font-medium">
          <dt className="flex-1">{deficit ? 'Deficit' : 'Surplus'}</dt>
          <dd><Amount value={m.surplusMinor} currency={currency} sensitive={false} /></dd>
        </div>
      </dl>
    </div>
  );
}

/** Every value of the trend, one row per month. */
export function TrendTable({ months, currency }: { months: MonthTrend[]; currency: string }) {
  const series = trendSeries(months);
  const last = months.length - 1;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Month</TableHead>
            {series.map((s) => <TableHead key={s.key} className="text-right">{s.name}</TableHead>)}
            {series[0]?.key === 'contributionsMinor' && <TableHead className="text-right">Payments</TableHead>}
            <TableHead className="text-right">Surplus / (deficit)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...months].reverse().map((m) => {
            const partial = m === months[last];
            return (
              <TableRow key={m.month}>
                <TableCell className="whitespace-nowrap">{formatPeriodKey(m.month)}{partial && <span className="ml-1 text-xs text-muted-foreground">to date</span>}</TableCell>
                {series.map((s) => <TableCell key={s.key} className="text-right"><Amount value={m[s.key]} currency={currency} bare sensitive={false} /></TableCell>)}
                {series[0]?.key === 'contributionsMinor' && <TableCell className="text-right tabular">{m.contributionPayments ?? '—'}</TableCell>}
                <TableCell className="text-right font-medium"><Amount value={m.surplusMinor} currency={currency} bare sensitive={false} /></TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
