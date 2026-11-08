'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/endpoints/books';
import type { CashAccountView } from '@/api/types';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { MoneyText } from '@/components/shared/Display';
import { Badge, NativeSelect, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { Param, ReportFrame } from '@/features/reports/ReportFrame';
import { csvMoney, downloadCsv } from '@/lib/csv';
import { formatDate, fractionDigits, startOfMonthNairobi, todayNairobi } from '@/lib/format';
import { label } from '@/lib/labels';

const ACCOUNTS = [
  { value: '', label: 'All cash accounts' },
  { value: '1000', label: 'Cash on hand (1000)' },
  { value: '1010', label: 'Bank (1010)' },
  { value: '1020', label: 'M-Pesa (1020)' },
];

export default function CashBookPage() {
  const [range, setRange] = useState<DateRangeValue>({ from: startOfMonthNairobi(), to: todayNairobi() });
  const [account, setAccount] = useState('');
  const q = useQuery({ queryKey: ['reports', 'cashBook', range, account], queryFn: () => reportsApi.cashBook({ ...range, account: account || undefined }) });
  const r = q.data;

  function exportCsv() {
    if (!r) return;
    const d = fractionDigits(r.currency);
    const rows = r.accounts.flatMap((a) => a.lines.map((l) => ({ a, l })));
    downloadCsv(`cash-book-${r.from}-${r.to}`, rows, [
      { header: 'Account', value: ({ a }) => `${a.code} ${a.name}` },
      { header: 'Date', value: ({ l }) => l.date },
      { header: 'Entry', value: ({ l }) => l.entryNumber },
      { header: 'Description', value: ({ l }) => l.description },
      { header: 'Reference', value: ({ l }) => l.reference },
      { header: 'Receipt', value: ({ l }) => csvMoney(l.receiptMinor, d) },
      { header: 'Payment', value: ({ l }) => csvMoney(l.paymentMinor, d) },
      { header: 'Balance', value: ({ l }) => csvMoney(l.balanceMinor, d) },
    ]);
  }

  return (
    <ReportFrame
      back={{ href: '/reports', label: 'Reports' }}
      title="Cash book"
      description={r && `${r.chamaName} · ${formatDate(r.from)} to ${formatDate(r.to)}`}
      params={
        <>
          <Param label="Account">
            <NativeSelect value={account} onChange={(e) => setAccount(e.target.value)} className="w-52">{ACCOUNTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</NativeSelect>
          </Param>
          <DateRangeFilter value={range} onChange={setRange} />
        </>
      }
      onCsv={exportCsv}
      onRefresh={() => q.refetch()}
      isLoading={q.isLoading}
      error={q.error}
      generatedAt={r?.generatedAt}
    >
      {r && (
        <div className="space-y-6">
          {r.accounts.length > 1 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                ['Opening', r.openingBalanceMinor],
                ['Receipts', r.receiptsMinor],
                ['Payments', r.paymentsMinor],
                ['Closing', r.closingBalanceMinor],
              ].map(([t, v]) => (
                <div key={t as string} className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{t} (all accounts)</p>
                  <p className="font-semibold"><MoneyText value={v as number} currency={r.currency} /></p>
                </div>
              ))}
            </div>
          )}
          {r.accounts.map((a) => <CashAccount key={a.code} a={a} currency={r.currency} />)}
        </div>
      )}
    </ReportFrame>
  );
}

function CashAccount({ a, currency }: { a: CashAccountView; currency: string }) {
  return (
    <div className="space-y-2">
      <h2 className="font-semibold">{a.code} · {a.name}</h2>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Date</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Receipts</TableHead>
              <TableHead className="text-right">Payments</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableCell colSpan={5} className="font-medium">Opening balance</TableCell>
              <TableCell className="text-right font-medium"><MoneyText value={a.openingBalanceMinor} currency={currency} /></TableCell>
            </TableRow>
            {a.lines.map((l, i) => (
              <TableRow key={`${l.entryNumber}-${i}`}>
                <TableCell className="whitespace-nowrap">{formatDate(l.date)}</TableCell>
                <TableCell>#{l.entryNumber}</TableCell>
                <TableCell className="min-w-[14rem]">{l.description} <Badge variant="outline" className="ml-1 text-[10px]">{label(l.sourceType)}</Badge>{l.reference && <span className="block text-xs text-muted-foreground">Ref {l.reference}</span>}</TableCell>
                <TableCell className="text-right">{l.receiptMinor ? <MoneyText value={l.receiptMinor} currency={currency} /> : ''}</TableCell>
                <TableCell className="text-right">{l.paymentMinor ? <MoneyText value={l.paymentMinor} currency={currency} /> : ''}</TableCell>
                <TableCell className="text-right"><MoneyText value={l.balanceMinor} currency={currency} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={3}>Totals and closing balance</TableCell>
              <TableCell className="text-right"><MoneyText value={a.receiptsMinor} currency={currency} /></TableCell>
              <TableCell className="text-right"><MoneyText value={a.paymentsMinor} currency={currency} /></TableCell>
              <TableCell className="text-right"><MoneyText value={a.closingBalanceMinor} currency={currency} /></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
