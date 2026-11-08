'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { contributionsApi } from '@/api/endpoints/savings';
import type { PeriodSummaryView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { Badge } from '@/components/ui/primitives';
import { CollectionBar } from '@/features/contributions/CollectionBar';
import { useCurrency } from '@/hooks/useSessionInfo';
import { csvMoney } from '@/lib/csv';
import { formatDate, formatPeriodKey, fractionDigits } from '@/lib/format';

const columns: ColumnDef<PeriodSummaryView, unknown>[] = [
  { id: 'key', header: 'Period', accessorFn: (s) => s.period.key, cell: ({ row }) => <span className="font-medium">{formatPeriodKey(row.original.period.key)}</span> },
  { id: 'dates', header: 'Dates', accessorFn: (s) => s.period.startDate, cell: ({ row }) => <span className="whitespace-nowrap text-sm">{formatDate(row.original.period.startDate)} – {formatDate(row.original.period.endDate)}</span> },
  {
    id: 'dueDate',
    header: 'Due',
    accessorFn: (s) => s.period.dueDate,
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        {formatDate(row.original.period.dueDate)}
        {row.original.due ? <Badge variant="warning">Due</Badge> : <Badge variant="outline">Upcoming</Badge>}
      </span>
    ),
  },
  { id: 'expected', header: 'Expected', accessorKey: 'expectedMinor', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.expectedMinor} currency={row.original.period.currency} /> },
  { id: 'collected', header: 'Collected', accessorKey: 'collectedMinor', cell: ({ row }) => <CollectionBar s={row.original} /> },
  { id: 'paid', header: 'Paid', accessorKey: 'membersPaid', cell: ({ row }) => <span className="tabular">{row.original.membersPaid} / {row.original.members}</span> },
  { id: 'late', header: 'Late', accessorKey: 'membersLate', cell: ({ row }) => (row.original.membersLate > 0 ? <span className="text-destructive">{row.original.membersLate}</span> : '0') },
];

export default function PeriodsPage() {
  return (
    <Guard permission="CONTRIBUTION_VIEW_ALL" feature="CONTRIBUTIONS">
      <Periods />
    </Guard>
  );
}

/** README §7.6: contribution periods with collection progress. Not paged by the API. */
function Periods() {
  const router = useRouter();
  const currency = useCurrency();
  const q = useQuery({ queryKey: ['contributions', 'periods'], queryFn: contributionsApi.periods });
  const digits = fractionDigits(currency);
  return (
    <div className="space-y-4">
      <PageHeader title="Contribution periods" description="What each period expected and what came in." />
      <DataTable
        columns={columns}
        data={q.data ? [...q.data].reverse() : undefined}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        getRowId={(s) => s.period.id}
        onRowClick={(s) => router.push(`/contributions/periods/${s.period.id}`)}
        emptyTitle="No periods yet"
        csv={{
          fileName: 'contribution-periods',
          columns: [
            { header: 'Period', value: (s) => s.period.key },
            { header: 'Start', value: (s) => s.period.startDate },
            { header: 'End', value: (s) => s.period.endDate },
            { header: 'Due date', value: (s) => s.period.dueDate },
            { header: 'Expected', value: (s) => csvMoney(s.expectedMinor, digits) },
            { header: 'Collected', value: (s) => csvMoney(s.collectedMinor, digits) },
            { header: 'Members', value: (s) => s.members },
            { header: 'Members paid', value: (s) => s.membersPaid },
            { header: 'Members late', value: (s) => s.membersLate },
          ],
        }}
        mobileCard={(s) => (
          <div className="space-y-2">
            <div className="flex justify-between gap-2">
              <span className="font-medium">{formatPeriodKey(s.period.key)}</span>
              <span className="text-xs text-muted-foreground">Due {formatDate(s.period.dueDate)}</span>
            </div>
            <CollectionBar s={s} />
            <p className="text-xs text-muted-foreground">{s.membersPaid} of {s.members} paid · {s.membersLate} late</p>
          </div>
        )}
      />
    </div>
  );
}
