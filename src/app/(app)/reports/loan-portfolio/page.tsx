'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/endpoints/books';
import { BarList } from '@/components/shared/Charts';
import { MoneyText, Section, StatusChip } from '@/components/shared/Display';
import { EmptyState } from '@/components/shared/States';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { ReportFrame } from '@/features/reports/ReportFrame';
import { csvMoney, downloadCsv } from '@/lib/csv';
import { formatBp, formatDate, formatMoney, fractionDigits, memberLabel } from '@/lib/format';

/** README §7.13: summary, ageing buckets and every loan, most overdue first. */
export default function LoanPortfolioPage() {
  const q = useQuery({ queryKey: ['reports', 'loanPortfolio'], queryFn: reportsApi.loanPortfolio });
  const r = q.data;
  const bucketLabel = (b: string) => r?.aging.find((a) => a.bucket === b)?.label ?? b;

  function exportCsv() {
    if (!r) return;
    const d = fractionDigits(r.currency);
    downloadCsv(`loan-portfolio-${r.asOf}`, r.loans, [
      { header: 'Member number', value: (l) => l.borrower.memberNumber },
      { header: 'Borrower', value: (l) => l.borrower.name },
      { header: 'Product', value: (l) => l.loan.productName },
      { header: 'Disbursed', value: (l) => l.loan.disbursedOn },
      { header: 'Principal', value: (l) => csvMoney(l.loan.principalMinor, d) },
      { header: 'Outstanding', value: (l) => csvMoney(l.loan.outstandingMinor, d) },
      { header: 'Arrears', value: (l) => csvMoney(l.loan.arrearsMinor, d) },
      { header: 'Days in arrears', value: (l) => l.loan.daysInArrears },
      { header: 'Bucket', value: (l) => bucketLabel(l.bucket) },
    ]);
  }

  const parTone = !r ? '' : r.par30BasisPoints > 1000 ? 'text-destructive' : r.par30BasisPoints > 500 ? 'text-warning' : 'text-success';
  return (
    <ReportFrame
      back={{ href: '/reports', label: 'Reports' }}
      title="Loan portfolio"
      description={r && `${r.chamaName} · as of ${formatDate(r.asOf)}`}
      onCsv={exportCsv}
      onRefresh={() => q.refetch()}
      isLoading={q.isLoading}
      error={q.error}
      generatedAt={r?.generatedAt}
    >
      {r && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {[
              { t: 'Active loans', v: r.activeLoans },
              { t: 'Outstanding', v: <MoneyText value={r.outstandingMinor} currency={r.currency} /> },
              { t: 'Arrears', v: <MoneyText value={r.arrearsMinor} currency={r.currency} className={r.arrearsMinor > 0 ? 'text-destructive' : undefined} />, h: `${r.loansInArrears} loans` },
              { t: 'PAR30', v: <span className={parTone}>{formatBp(r.par30BasisPoints)}</span>, h: 'Amber over 5%, red over 10%' },
              { t: 'Pipeline', v: <MoneyText value={r.pipelineMinor} currency={r.currency} />, h: `${r.awaitingApproval} to approve · ${r.awaitingDisbursement} to disburse` },
            ].map((x) => (
              <div key={x.t} className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">{x.t}</p>
                <p className="text-lg font-semibold">{x.v}</p>
                {x.h && <p className="text-xs text-muted-foreground">{x.h}</p>}
              </div>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Outstanding by days overdue">
              <BarList items={r.aging.map((a) => ({ key: a.bucket, label: `${a.label} (${a.loans})`, value: a.outstandingMinor, hint: `Arrears ${formatMoney(a.arrearsMinor, r.currency)}` }))} currency={r.currency} />
            </Section>
            <Section title="Ageing">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Bucket</TableHead>
                    <TableHead className="text-right">Loans</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Arrears</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.aging.map((a) => (
                    <TableRow key={a.bucket}>
                      <TableCell>{a.label}</TableCell>
                      <TableCell className="text-right">{a.loans}</TableCell>
                      <TableCell className="text-right"><MoneyText value={a.outstandingMinor} currency={r.currency} /></TableCell>
                      <TableCell className="text-right"><MoneyText value={a.arrearsMinor} currency={r.currency} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          </div>
          <Section title="Loans">
            {r.loans.length === 0 ? <EmptyState title="No active loans" className="py-6" /> : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Borrower</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Arrears</TableHead>
                      <TableHead className="text-right">Days</TableHead>
                      <TableHead>Bucket</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {r.loans.map((l) => (
                      <TableRow key={l.loan.id}>
                        <TableCell><Link href={`/loans/${l.loan.id}`} className="font-medium hover:underline">{memberLabel(l.borrower.name, l.borrower.memberNumber)}</Link></TableCell>
                        <TableCell>{l.loan.productName}</TableCell>
                        <TableCell><StatusChip status={l.loan.status} /></TableCell>
                        <TableCell className="text-right"><MoneyText value={l.loan.outstandingMinor} currency={l.loan.currency} /></TableCell>
                        <TableCell className="text-right"><MoneyText value={l.loan.arrearsMinor} currency={l.loan.currency} className={l.loan.arrearsMinor > 0 ? 'text-destructive' : undefined} /></TableCell>
                        <TableCell className="text-right tabular">{l.loan.daysInArrears}</TableCell>
                        <TableCell><Badge variant={l.bucket === 'CURRENT' ? 'success' : l.bucket === 'DAYS_1_30' ? 'warning' : 'destructive'}>{bucketLabel(l.bucket)}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Section>
        </div>
      )}
    </ReportFrame>
  );
}
