'use client';

import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/endpoints/books';
import { MoneyText } from '@/components/shared/Display';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { ReportFrame } from '@/features/reports/ReportFrame';
import { csvMoney, downloadCsv } from '@/lib/csv';
import { fractionDigits, memberLabel } from '@/lib/format';

/** README §7.13: members × savings products. */
export default function SavingsRegisterPage() {
  const q = useQuery({ queryKey: ['reports', 'savings'], queryFn: reportsApi.savings });
  const r = q.data;

  function exportCsv() {
    if (!r) return;
    const d = fractionDigits(r.currency);
    downloadCsv('savings-register', r.members, [
      { header: 'Member number', value: (m) => m.member.memberNumber },
      { header: 'Member', value: (m) => m.member.name },
      ...r.products.map((p, i) => ({ header: `${p.code} ${p.name}`, value: (m: (typeof r.members)[number]) => csvMoney(m.balances[i], d) })),
      { header: 'Total', value: (m) => csvMoney(m.totalMinor, d) },
    ]);
  }

  return (
    <ReportFrame
      back={{ href: '/reports', label: 'Reports' }}
      title="Savings register"
      description={r && <>{r.chamaName} · total <MoneyText value={r.totalMinor} currency={r.currency} className="font-medium" /></>}
      onCsv={exportCsv}
      onRefresh={() => q.refetch()}
      isLoading={q.isLoading}
      error={q.error}
      generatedAt={r?.generatedAt}
    >
      {r && (
        <div className="max-h-[70vh] overflow-auto rounded-lg border bg-card">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-20 min-w-[12rem] bg-card">Member</TableHead>
                {r.products.map((p) => <TableHead key={p.productId} className="whitespace-nowrap text-right">{p.name}{!p.active && ' (inactive)'}</TableHead>)}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.members.map((m) => (
                <TableRow key={m.member.userId}>
                  <TableCell className="sticky left-0 bg-card font-medium">{memberLabel(m.member.name, m.member.memberNumber)}</TableCell>
                  {m.balances.map((b, i) => <TableCell key={r.products[i]?.productId ?? i} className="text-right"><MoneyText value={b} currency={r.currency} /></TableCell>)}
                  <TableCell className="text-right font-medium"><MoneyText value={m.totalMinor} currency={r.currency} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="sticky left-0 bg-muted">Totals</TableCell>
                {r.products.map((p) => <TableCell key={p.productId} className="text-right"><MoneyText value={p.totalMinor} currency={r.currency} /></TableCell>)}
                <TableCell className="text-right"><MoneyText value={r.totalMinor} currency={r.currency} /></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </ReportFrame>
  );
}
