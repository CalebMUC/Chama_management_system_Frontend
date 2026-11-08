'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Clock, Plus, Receipt } from 'lucide-react';
import { expensesApi } from '@/api/endpoints/spending';
import type { ExpenseStatus, ExpenseView } from '@/api/types';
import { Can, Guard } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { MoneyText, PageHeader, StatCard, StatusChip } from '@/components/shared/Display';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/primitives';
import { ExpenseDialog } from '@/features/expenses/ExpenseDialog';
import { usePaged } from '@/hooks/usePaged';
import { useCurrency } from '@/hooks/useSessionInfo';
import { csvMoney } from '@/lib/csv';
import { formatDate, fractionDigits, startOfMonthNairobi, todayNairobi } from '@/lib/format';
import { label } from '@/lib/labels';

const STATUSES: ExpenseStatus[] = ['PENDING_APPROVAL', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED'];

const columns: ColumnDef<ExpenseView, unknown>[] = [
  { id: 'incurred', header: 'Incurred', accessorKey: 'incurredOn', cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.incurredOn)}</span> },
  { id: 'payee', header: 'Payee', accessorKey: 'payee', cell: ({ row }) => <span className="font-medium">{row.original.payee}</span> },
  { id: 'description', header: 'Description', accessorKey: 'description', cell: ({ row }) => <span className="line-clamp-2 min-w-[12rem]">{row.original.description}</span> },
  { id: 'account', header: 'Account', accessorKey: 'accountName', cell: ({ row }) => <span className="text-sm">{row.original.accountName}{row.original.investmentName && <span className="block text-xs text-muted-foreground">{row.original.investmentName}</span>}</span> },
  { id: 'amount', header: 'Amount', accessorKey: 'amountMinor', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.amountMinor} currency={row.original.currency} /> },
  { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusChip status={row.original.status} /> },
  {
    id: 'approvals',
    header: 'Approvals',
    cell: ({ row }) => (row.original.status === 'PENDING_APPROVAL' || row.original.status === 'APPROVED' ? <span className="tabular">{row.original.approvals.length}/{row.original.requiredApprovals}</span> : '—'),
  },
  { id: 'requestedBy', header: 'Requested by', accessorFn: (e) => e.requestedByName ?? '' },
];

export default function ExpensesPage() {
  return (
    <Guard permission="EXPENSE_VIEW" feature="EXPENSES">
      <Expenses />
    </Guard>
  );
}

/** README §7.10. */
function Expenses() {
  const router = useRouter();
  const params = useSearchParams();
  const currency = useCurrency();
  const [summaryRange, setSummaryRange] = useState<DateRangeValue>({ from: startOfMonthNairobi(), to: todayNairobi() });
  const [status, setStatus] = useState<ExpenseStatus | ''>((params.get('status') as ExpenseStatus | null) ?? '');
  const [range, setRange] = useState<DateRangeValue>({});
  const investmentId = params.get('investmentId') ?? undefined;
  const [creating, setCreating] = useState(false);
  const summary = useQuery({ queryKey: ['expenses', 'summary', summaryRange], queryFn: () => expensesApi.summary(summaryRange) });
  const list = usePaged(['expenses', 'list'], { status: status || undefined, investmentId, from: range.from, to: range.to }, expensesApi.list);
  const digits = fractionDigits(currency);
  const s = summary.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Expenses"
        description={investmentId ? 'Expenses for one investment.' : 'What the chama spends, approved before it is paid.'}
        actions={<Can permission="EXPENSE_CREATE"><Button onClick={() => setCreating(true)}><Plus />Record expense</Button></Can>}
      />
      <div className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Summary</h2>
          <DateRangeFilter value={summaryRange} onChange={setSummaryRange} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Paid" value={<MoneyText value={s?.paidMinor} />} hint={s && `${s.paidCount} expense${s.paidCount === 1 ? '' : 's'}`} icon={<Receipt />} />
          <StatCard label="Awaiting payment" value={<MoneyText value={s?.awaitingPaymentMinor} />} hint="Pending approval or approved" icon={<Clock />} tone="warning" />
          {(s?.byAccount ?? []).slice(0, 2).map((a) => (
            <StatCard key={a.accountCode} label={a.accountName} value={<MoneyText value={a.totalMinor} />} hint={`${a.count} paid`} />
          ))}
        </div>
        {(s?.byAccount.length ?? 0) > 2 && (
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {s!.byAccount.slice(2).map((a) => <li key={a.accountCode} className="flex justify-between"><span className="text-muted-foreground">{a.accountName}</span><MoneyText value={a.totalMinor} /></li>)}
          </ul>
        )}
      </div>
      <DataTable
        columns={columns}
        getRowId={(e) => e.id}
        onRowClick={(e) => router.push(`/expenses/${e.id}`)}
        emptyTitle="No expenses"
        toolbar={
          <>
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus | '')} className="w-48" aria-label="Status">
              <option value="">All statuses</option>
              {STATUSES.map((st) => <option key={st} value={st}>{label(st)}</option>)}
            </NativeSelect>
            <DateRangeFilter value={range} onChange={setRange} />
            {investmentId && <Button variant="ghost" size="sm" onClick={() => router.replace('/expenses')}>Show all expenses</Button>}
          </>
        }
        csv={{
          fileName: 'expenses',
          columns: [
            { header: 'Incurred on', value: (e) => e.incurredOn },
            { header: 'Payee', value: (e) => e.payee },
            { header: 'Description', value: (e) => e.description },
            { header: 'Account', value: (e) => `${e.accountCode} ${e.accountName}` },
            { header: 'Investment', value: (e) => e.investmentName },
            { header: 'Amount', value: (e) => csvMoney(e.amountMinor, digits) },
            { header: 'Status', value: (e) => e.status },
            { header: 'Requested by', value: (e) => e.requestedByName },
            { header: 'Paid on', value: (e) => e.paidOn },
            { header: 'Method', value: (e) => e.paymentMethod },
            { header: 'Reference', value: (e) => e.paymentReference },
          ],
        }}
        mobileCard={(e) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{e.payee}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{formatDate(e.incurredOn)} · {e.description}</p>
            </div>
            <div className="shrink-0 text-right">
              <MoneyText value={e.amountMinor} currency={e.currency} className="font-medium" />
              <div className="mt-1"><StatusChip status={e.status} /></div>
            </div>
          </div>
        )}
        {...list.table}
      />
      <ExpenseDialog open={creating} onOpenChange={setCreating} investmentId={investmentId} onCreated={(id) => router.push(`/expenses/${id}`)} />
    </div>
  );
}
