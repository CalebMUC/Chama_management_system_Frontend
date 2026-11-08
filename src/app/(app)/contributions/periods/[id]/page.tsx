'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { contributionsApi } from '@/api/endpoints/savings';
import type { MemberPeriodView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DetailList, MoneyText, PageHeader, StatusChip } from '@/components/shared/Display';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Card, CardContent } from '@/components/ui/primitives';
import { CollectionBar } from '@/features/contributions/CollectionBar';
import { csvMoney } from '@/lib/csv';
import { formatDate, formatPeriodKey, fractionDigits, memberLabel } from '@/lib/format';

export default function PeriodDetailPage() {
  return (
    <Guard permission="CONTRIBUTION_VIEW_ALL" feature="CONTRIBUTIONS">
      <PeriodDetail />
    </Guard>
  );
}

function PeriodDetail() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['contributions', 'periods', id], queryFn: () => contributionsApi.period(id) });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  const { summary: s, members } = q.data;
  const c = s.period.currency;
  const columns: ColumnDef<MemberPeriodView, unknown>[] = [
    { id: 'member', header: 'Member', accessorFn: (m) => memberLabel(m.memberName, m.memberNumber) },
    { id: 'due', header: 'Due', accessorKey: 'amountDueMinor', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.amountDueMinor} currency={c} /> },
    { id: 'paid', header: 'Paid', accessorKey: 'paidMinor', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.paidMinor} currency={c} /> },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5">
          <StatusChip status={row.original.status} />
          {row.original.late && <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" />Late</span>}
        </span>
      ),
    },
  ];
  const digits = fractionDigits(c);
  return (
    <div className="space-y-5">
      <PageHeader back={{ href: '/contributions/periods', label: 'Periods' }} title={formatPeriodKey(s.period.key)} />
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <DetailList
            columns={4}
            items={[
              { label: 'Dates', value: `${formatDate(s.period.startDate)} – ${formatDate(s.period.endDate)}` },
              { label: 'Due date', value: <>{formatDate(s.period.dueDate)} {s.due && <StatusChip status="DUE" />}</> },
              { label: 'Each member owes', value: <MoneyText value={s.period.amountDueMinor} currency={c} /> },
              { label: 'Members paid', value: `${s.membersPaid} of ${s.members} (${s.membersLate} late)` },
            ]}
          />
          <div className="max-w-md">
            <p className="mb-1 text-xs text-muted-foreground">Collected of <MoneyText value={s.expectedMinor} currency={c} /> expected</p>
            <CollectionBar s={s} />
          </div>
          {s.period.products.length > 1 && (
            <p className="text-xs text-muted-foreground">Per member: {s.period.products.map((p) => `${p.productName} ${csvMoney(p.amountMinor, digits)}`).join(' · ')}</p>
          )}
        </CardContent>
      </Card>
      <DataTable
        columns={columns}
        data={members}
        getRowId={(m) => m.memberUserId}
        searchable
        searchPlaceholder="Find a member"
        rowClassName={(m) => (m.status === 'UNPAID' && s.due ? 'bg-destructive/5' : undefined)}
        csv={{
          fileName: `period-${s.period.key}`,
          columns: [
            { header: 'Member number', value: (m) => m.memberNumber },
            { header: 'Member', value: (m) => m.memberName },
            { header: 'Due', value: (m) => csvMoney(m.amountDueMinor, digits) },
            { header: 'Paid', value: (m) => csvMoney(m.paidMinor, digits) },
            { header: 'Status', value: (m) => m.status },
            { header: 'Late', value: (m) => (m.late ? 'yes' : 'no') },
          ],
        }}
        mobileCard={(m) => (
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{memberLabel(m.memberName, m.memberNumber)}</span>
            <span className="text-right text-sm">
              <StatusChip status={m.status} />
              <span className="mt-1 block"><MoneyText value={m.paidMinor} currency={c} /> / <MoneyText value={m.amountDueMinor} currency={c} /></span>
            </span>
          </div>
        )}
      />
    </div>
  );
}
