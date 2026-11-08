'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ledgerApi } from '@/api/endpoints/books';
import { Guard } from '@/components/shared/Can';
import { MoneyText } from '@/components/shared/Display';
import { Badge, Input, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { Param, ReportFrame } from '@/features/reports/ReportFrame';
import { csvMoney, downloadCsv } from '@/lib/csv';
import { formatDate, fractionDigits, todayNairobi } from '@/lib/format';
import { ACCOUNT_TYPES } from '@/lib/labels';

export default function TrialBalancePage() {
  return (
    <Guard permission="LEDGER_VIEW">
      <TrialBalance />
    </Guard>
  );
}

/** README §7.12. */
function TrialBalance() {
  const [asOf, setAsOf] = useState(todayNairobi());
  const q = useQuery({ queryKey: ['ledger', 'trialBalance', asOf], queryFn: () => ledgerApi.trialBalance(asOf) });
  const t = q.data;

  function exportCsv() {
    if (!t) return;
    const d = fractionDigits(t.currency);
    downloadCsv(`trial-balance-${t.asOf}`, t.rows, [
      { header: 'Code', value: (r) => r.code },
      { header: 'Name', value: (r) => r.name },
      { header: 'Type', value: (r) => r.type },
      { header: 'Debit', value: (r) => csvMoney(r.debitMinor, d) },
      { header: 'Credit', value: (r) => csvMoney(r.creditMinor, d) },
    ]);
  }

  return (
    <ReportFrame
      title="Trial balance"
      description={t && <span className="flex items-center gap-2">As of {formatDate(t.asOf)} {t.balanced ? <Badge variant="success"><CheckCircle2 className="size-3" />Balanced</Badge> : <Badge variant="destructive"><XCircle className="size-3" />Not balanced</Badge>}</span>}
      params={<Param label="As of"><Input type="date" value={asOf} max={todayNairobi()} onChange={(e) => e.target.value && setAsOf(e.target.value)} className="w-44" /></Param>}
      onCsv={exportCsv}
      onRefresh={() => q.refetch()}
      isLoading={q.isLoading}
      error={q.error}
    >
      {t && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-24">Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ACCOUNT_TYPES.map((g) => {
                const rows = t.rows.filter((r) => r.type === g.type);
                if (!rows.length) return null;
                return (
                  <Fragment key={g.type}>
                    <TableRow className="bg-muted/50 hover:bg-muted/50"><TableCell colSpan={4} className="py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</TableCell></TableRow>
                    {rows.map((r) => (
                      <TableRow key={r.accountId}>
                        <TableCell className="font-mono">{r.code}</TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell className="text-right">{r.debitMinor ? <MoneyText value={r.debitMinor} currency={t.currency} /> : ''}</TableCell>
                        <TableCell className="text-right">{r.creditMinor ? <MoneyText value={r.creditMinor} currency={t.currency} /> : ''}</TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={2}>Totals</TableCell>
                <TableCell className="text-right"><MoneyText value={t.totalDebitsMinor} currency={t.currency} /></TableCell>
                <TableCell className="text-right"><MoneyText value={t.totalCreditsMinor} currency={t.currency} /></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </ReportFrame>
  );
}
