'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/endpoints/books';
import type { ContributionCell } from '@/api/types';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { MoneyText } from '@/components/shared/Display';
import { EmptyState } from '@/components/shared/States';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { ReportFrame } from '@/features/reports/ReportFrame';
import { csvMoney, downloadCsv } from '@/lib/csv';
import { formatMoney, formatPeriodKey, fractionDigits, memberLabel, startOfYearNairobi, todayNairobi } from '@/lib/format';
import { cn } from '@/lib/utils';

const STATUS_STYLE: Record<string, string> = {
  PAID: 'bg-success/10 text-success',
  PARTIALLY_PAID: 'bg-warning/15 text-foreground',
  UNPAID: 'bg-destructive/10 text-destructive',
};
const STATUS_MARK: Record<string, string> = { PAID: '✓', PARTIALLY_PAID: '½', UNPAID: '✗' };

/** README §7.13: members × periods, each cell "paid / due" by status, with a late marker. */
export default function ContributionsReportPage() {
  const [range, setRange] = useState<DateRangeValue>({ from: startOfYearNairobi(), to: todayNairobi() });
  const q = useQuery({ queryKey: ['reports', 'contributions', range], queryFn: () => reportsApi.contributions(range) });
  const r = q.data;

  function exportCsv() {
    if (!r) return;
    const d = fractionDigits(r.currency);
    downloadCsv('contributions-report', r.members, [
      { header: 'Member number', value: (m) => m.member.memberNumber },
      { header: 'Member', value: (m) => m.member.name },
      ...r.periods.map((p, i) => ({ header: `${p.key} paid/due`, value: (m: (typeof r.members)[number]) => { const c = m.cells[i]; return c ? `${csvMoney(c.paidMinor, d)}/${csvMoney(c.dueMinor, d)}${c.late ? ' late' : ''}` : ''; } })),
      { header: 'Total paid', value: (m) => csvMoney(m.standing.totalPaidMinor, d) },
      { header: 'Arrears', value: (m) => csvMoney(m.standing.arrearsMinor, d) },
      { header: 'Advance', value: (m) => csvMoney(m.standing.advanceMinor, d) },
    ]);
  }

  return (
    <ReportFrame
      back={{ href: '/reports', label: 'Reports' }}
      title="Contributions"
      description={r && <>Collected <MoneyText value={r.collectedMinor} currency={r.currency} /> of <MoneyText value={r.expectedMinor} currency={r.currency} /> · arrears <MoneyText value={r.arrearsMinor} currency={r.currency} className="text-destructive" /></>}
      params={<DateRangeFilter value={range} onChange={setRange} />}
      onCsv={exportCsv}
      onRefresh={() => q.refetch()}
      isLoading={q.isLoading}
      error={q.error}
      generatedAt={r?.generatedAt}
    >
      {r && (r.periods.length === 0 ? <EmptyState title="No periods in this range" /> : (
        <div className="space-y-2">
          <p className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span><span className="text-success">✓</span> paid</span><span>½ part paid</span><span><span className="text-destructive">✗</span> unpaid</span><span>• late</span>
          </p>
          <div className="max-h-[70vh] overflow-auto rounded-lg border bg-card">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="sticky left-0 z-20 min-w-[12rem] bg-card">Member</TableHead>
                  {r.periods.map((p) => <TableHead key={p.periodId} className="whitespace-nowrap text-center">{formatPeriodKey(p.key)}</TableHead>)}
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Arrears</TableHead>
                  <TableHead className="text-right">Advance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.members.map((m) => (
                  <TableRow key={m.member.userId}>
                    <TableCell className="sticky left-0 bg-card font-medium">{memberLabel(m.member.name, m.member.memberNumber)}</TableCell>
                    {m.cells.map((c, i) => <Cell key={r.periods[i]?.periodId ?? i} c={c} currency={r.currency} />)}
                    <TableCell className="text-right"><MoneyText value={m.standing.totalPaidMinor} currency={r.currency} /></TableCell>
                    <TableCell className="text-right"><MoneyText value={m.standing.arrearsMinor} currency={r.currency} className={m.standing.arrearsMinor > 0 ? 'text-destructive' : undefined} /></TableCell>
                    <TableCell className="text-right"><MoneyText value={m.standing.advanceMinor} currency={r.currency} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell className="sticky left-0 bg-muted">Collected / expected</TableCell>
                  {r.periods.map((p) => (
                    <TableCell key={p.periodId} className="whitespace-nowrap text-center text-xs">
                      {formatMoney(p.collectedMinor, r.currency)}<span className="block text-muted-foreground">of {formatMoney(p.expectedMinor, r.currency)}</span>
                    </TableCell>
                  ))}
                  <TableCell className="text-right"><MoneyText value={r.collectedMinor} currency={r.currency} /></TableCell>
                  <TableCell className="text-right"><MoneyText value={r.arrearsMinor} currency={r.currency} /></TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      ))}
    </ReportFrame>
  );
}

function Cell({ c, currency }: { c: ContributionCell | null; currency: string }) {
  if (!c) return <TableCell className="text-center text-muted-foreground">—</TableCell>;
  return (
    <TableCell className="p-1 text-center">
      <span className={cn('block whitespace-nowrap rounded px-1.5 py-1 text-xs tabular', STATUS_STYLE[c.status])} title={`${c.status.replace('_', ' ').toLowerCase()}${c.late ? ', late' : ''}`}>
        {STATUS_MARK[c.status]} {formatMoney(c.paidMinor, currency, { symbol: false })} / {formatMoney(c.dueMinor, currency, { symbol: false })}{c.late && ' •'}
      </span>
    </TableCell>
  );
}
