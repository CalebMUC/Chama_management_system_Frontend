'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { exitsApi } from '@/api/endpoints/exits';
import type { ExitStatus, ExitView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { NativeSelect } from '@/components/ui/primitives';
import { EXIT_STATUSES, isExitOpen } from '@/features/exits/exitRules';
import { ExitStatusChip } from '@/features/exits/SettlementStatement';
import { usePaged } from '@/hooks/usePaged';
import { useCurrency } from '@/hooks/useSessionInfo';
import { csvMoney } from '@/lib/csv';
import { formatInstantDate, fractionDigits, memberLabel } from '@/lib/format';
import { label } from '@/lib/labels';

const columns: ColumnDef<ExitView, unknown>[] = [
  {
    id: 'member',
    header: 'Member',
    accessorFn: (e) => memberLabel(e.memberName, e.memberNumber),
    cell: ({ row }) => <span className="font-medium">{memberLabel(row.original.memberName, row.original.memberNumber)}</span>,
  },
  { id: 'reason', header: 'Reason', accessorKey: 'reason', cell: ({ row }) => <span className="line-clamp-2 min-w-[12rem]">{row.original.reason}</span> },
  {
    id: 'payout',
    header: 'Payout',
    accessorFn: (e) => e.settlement.payoutMinor,
    meta: { numeric: true },
    cell: ({ row }) => <MoneyText value={row.original.settlement.payoutMinor} currency={row.original.settlement.currency} />,
  },
  { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <ExitStatusChip status={row.original.status} /> },
  {
    id: 'approvals',
    header: 'Approvals',
    cell: ({ row }) => (isExitOpen(row.original.status) || row.original.status === 'SETTLED'
      ? <span className="tabular">{row.original.approvals.length} of {row.original.requiredApprovals}</span>
      : '—'),
  },
  {
    id: 'requested',
    header: 'Requested',
    accessorKey: 'requestedAt',
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatInstantDate(row.original.requestedAt)}
        {row.original.requestedByName && <span className="block text-xs text-muted-foreground">by {row.original.requestedByName}</span>}
      </span>
    ),
  },
];

export default function MemberExitsPage() {
  return (
    <Guard permission="MEMBER_VIEW">
      <MemberExits />
    </Guard>
  );
}

/** §3a: members leaving, maker-checker like expenses. Exits are started from the member's page. */
function MemberExits() {
  const router = useRouter();
  const params = useSearchParams();
  const digits = fractionDigits(useCurrency());
  const [status, setStatus] = useState<ExitStatus | ''>((params.get('status') as ExitStatus | null) ?? '');
  const list = usePaged(['memberExits', 'list'], { status: status || undefined }, exitsApi.list);

  return (
    <div className="space-y-4">
      <PageHeader title="Member exits" description="Members leaving the chama. Start an exit from the member's page; officials approve the settlement before it is paid out." />
      <DataTable
        columns={columns}
        getRowId={(e) => e.id}
        onRowClick={(e) => router.push(`/members/exits/${e.id}`)}
        emptyTitle="No member exits"
        toolbar={
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as ExitStatus | '')} className="w-48" aria-label="Status">
            <option value="">All statuses</option>
            {EXIT_STATUSES.map((st) => <option key={st} value={st}>{label(st)}</option>)}
          </NativeSelect>
        }
        csv={{
          fileName: 'member-exits',
          columns: [
            { header: 'Member number', value: (e) => e.memberNumber },
            { header: 'Member', value: (e) => e.memberName },
            { header: 'Reason', value: (e) => e.reason },
            { header: 'Refundable', value: (e) => csvMoney(e.settlement.refundableMinor, digits) },
            { header: 'Loans', value: (e) => csvMoney(e.settlement.loansMinor, digits) },
            { header: 'Penalties', value: (e) => csvMoney(e.settlement.penaltiesMinor, digits) },
            { header: 'Payout', value: (e) => csvMoney(e.settlement.payoutMinor, digits) },
            { header: 'Kept by the chama', value: (e) => csvMoney(e.settlement.forfeitedMinor, digits) },
            { header: 'Status', value: (e) => e.status },
            { header: 'Approvals', value: (e) => `${e.approvals.length}/${e.requiredApprovals}` },
            { header: 'Requested at', value: (e) => e.requestedAt },
            { header: 'Requested by', value: (e) => e.requestedByName },
            { header: 'Settled on', value: (e) => e.settledOn },
            { header: 'Method', value: (e) => e.paymentMethod },
            { header: 'Reference', value: (e) => e.paymentReference },
          ],
        }}
        mobileCard={(e) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{memberLabel(e.memberName, e.memberNumber)}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{formatInstantDate(e.requestedAt)} · {e.reason}</p>
            </div>
            <div className="shrink-0 text-right">
              <MoneyText value={e.settlement.payoutMinor} currency={e.settlement.currency} className="font-medium" />
              <div className="mt-1"><ExitStatusChip status={e.status} /></div>
            </div>
          </div>
        )}
        {...list.table}
      />
    </div>
  );
}
