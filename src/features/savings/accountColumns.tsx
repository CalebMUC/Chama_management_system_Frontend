'use client';

import type { MemberAccountView } from '@/api/types';
import type { ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, StatusChip } from '@/components/shared/Display';
import { csvMoney, type CsvColumn } from '@/lib/csv';
import { formatDate, memberLabel } from '@/lib/format';

export function accountColumns(withMember = true): ColumnDef<MemberAccountView, unknown>[] {
  const cols: ColumnDef<MemberAccountView, unknown>[] = [
    { id: 'number', header: 'Account', accessorKey: 'accountNumber', cell: ({ row }) => <span className="font-mono text-sm">{row.original.accountNumber}</span> },
  ];
  if (withMember) cols.push({ id: 'member', header: 'Member', accessorFn: (a) => memberLabel(a.memberName, a.memberNumber) });
  cols.push(
    { id: 'product', header: 'Product', accessorKey: 'productName' },
    { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusChip status={row.original.status} /> },
    { id: 'opened', header: 'Opened', accessorKey: 'openedOn', cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.openedOn)}</span> },
    { id: 'balance', header: 'Balance', accessorKey: 'balanceMinor', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.balanceMinor} currency={row.original.currency} className="font-medium" /> },
  );
  return cols;
}

export function accountCsv(digits: number): CsvColumn<MemberAccountView>[] {
  return [
    { header: 'Account', value: (a) => a.accountNumber },
    { header: 'Member number', value: (a) => a.memberNumber },
    { header: 'Member', value: (a) => a.memberName },
    { header: 'Product', value: (a) => a.productName },
    { header: 'Status', value: (a) => a.status },
    { header: 'Opened', value: (a) => a.openedOn },
    { header: 'Balance', value: (a) => csvMoney(a.balanceMinor, digits) },
  ];
}

export function AccountMobileCard({ a }: { a: MemberAccountView }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium">{a.productName}</p>
        <p className="text-xs text-muted-foreground">{a.accountNumber} · {memberLabel(a.memberName, a.memberNumber)}</p>
      </div>
      <div className="shrink-0 text-right">
        <MoneyText value={a.balanceMinor} currency={a.currency} className="font-medium" />
        <div className="mt-1"><StatusChip status={a.status} /></div>
      </div>
    </div>
  );
}
