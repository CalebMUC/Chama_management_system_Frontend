'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AlertTriangle, Send } from 'lucide-react';
import { contributionsApi } from '@/api/endpoints/savings';
import type { MyPeriodView } from '@/api/types';
import { Can, Guard } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, Section, StatusChip } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { reportPaymentHref } from '@/features/submissions/submissionLinks';
import { StandingSummary } from '@/features/contributions/StandingSummary';
import { paymentColumns } from '@/features/contributions/paymentColumns';
import { formatDate, formatPeriodKey } from '@/lib/format';
import { label } from '@/lib/labels';

const periodColumns: ColumnDef<MyPeriodView, unknown>[] = [
  { id: 'key', header: 'Period', accessorFn: (p) => p.period.key, cell: ({ row }) => <span className="font-medium">{formatPeriodKey(row.original.period.key)}</span> },
  { id: 'due', header: 'Due date', accessorFn: (p) => p.period.dueDate, cell: ({ row }) => formatDate(row.original.period.dueDate) },
  { id: 'amountDue', header: 'Due', accessorKey: 'amountDueMinor', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.amountDueMinor} currency={row.original.period.currency} /> },
  { id: 'paid', header: 'Paid', accessorKey: 'paidMinor', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.paidMinor} currency={row.original.period.currency} /> },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status',
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <StatusChip status={row.original.status} />
        {row.original.late && <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" />Late</span>}
        {!row.original.due && <span className="text-xs text-muted-foreground">Not yet due</span>}
      </span>
    ),
  },
];

export default function MyContributionsPage() {
  return (
    <Guard feature="CONTRIBUTIONS">
      <MyContributions />
    </Guard>
  );
}

function MyContributions() {
  const q = useQuery({ queryKey: ['contributions', 'me'], queryFn: contributionsApi.mine });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  const d = q.data;
  return (
    <div className="space-y-5">
      <PageHeader
        title="My contributions"
        description="Paid by M-Pesa or at the bank? Report it and the treasurer records it here once they have checked it."
        actions={<Can permission="PAYMENT_SUBMIT"><Button asChild><Link href={reportPaymentHref({ kind: 'CONTRIBUTION' })}><Send />Report a contribution</Link></Button></Can>}
      />
      <StandingSummary standing={d.standing} />
      <Section title="Periods">
        <DataTable
          columns={periodColumns}
          data={[...d.periods].reverse()}
          getRowId={(p) => p.period.id}
          emptyTitle="No periods yet"
          mobileCard={(p) => (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{formatPeriodKey(p.period.key)}</p>
                <p className="text-xs text-muted-foreground">Due {formatDate(p.period.dueDate)}{p.late && ' · late'}</p>
              </div>
              <div className="text-right text-sm">
                <StatusChip status={p.status} />
                <p className="mt-1"><MoneyText value={p.paidMinor} currency={p.period.currency} /> / <MoneyText value={p.amountDueMinor} currency={p.period.currency} /></p>
              </div>
            </div>
          )}
        />
      </Section>
      <Section title="Recent payments">
        <DataTable
          columns={paymentColumns(false)}
          data={d.recentPayments}
          getRowId={(p) => p.id}
          emptyTitle="No payments yet"
          mobileCard={(p) => (
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium"><MoneyText value={p.amountMinor} currency={p.currency} /></p>
                <p className="text-xs text-muted-foreground">{formatDate(p.paidOn)} · {label(p.method)}{p.reference && ` ${p.reference}`}</p>
              </div>
              <StatusChip status={p.status} />
            </div>
          )}
        />
      </Section>
    </div>
  );
}
