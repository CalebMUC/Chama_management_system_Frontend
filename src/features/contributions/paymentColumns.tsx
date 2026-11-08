'use client';

import type { PaymentView } from '@/api/types';
import type { ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, StatusChip } from '@/components/shared/Display';
import { Tooltip } from '@/components/ui/overlays';
import type { CsvColumn } from '@/lib/csv';
import { csvMoney } from '@/lib/csv';
import { formatDate, formatInstant, memberLabel } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';

export function PaymentStatus({ p }: { p: PaymentView }) {
  if (p.status === 'REVERSED') {
    return <Tooltip content={p.reversalReason ? `Reversed: ${p.reversalReason}` : 'Reversed'}><span><StatusChip status="REVERSED" /></span></Tooltip>;
  }
  return <StatusChip status={p.status} />;
}

export const allocationText = (p: PaymentView) => p.allocations.map((a) => `${a.productName}`).join(', ');

/** Payments table columns (README §7.6). `withMember` adds the member column for officials. */
export function paymentColumns(withMember: boolean): ColumnDef<PaymentView, unknown>[] {
  const cols: ColumnDef<PaymentView, unknown>[] = [
    { id: 'paidOn', header: 'Date paid', accessorKey: 'paidOn', cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.paidOn)}</span> },
  ];
  if (withMember) cols.push({ id: 'member', header: 'Member', accessorFn: (p) => memberLabel(p.memberName, p.memberNumber) });
  cols.push(
    {
      id: 'amount',
      header: 'Amount',
      accessorKey: 'amountMinor',
      meta: { align: 'right' },
      cell: ({ row }) => <MoneyText value={row.original.amountMinor} currency={row.original.currency} className={cn(row.original.status === 'REVERSED' && 'line-through opacity-60')} />,
    },
    {
      id: 'method',
      header: 'Method',
      accessorFn: (p) => `${label(p.method)} ${p.reference ?? ''}`,
      cell: ({ row }) => (
        <span className="text-sm">
          {label(row.original.method)}
          {row.original.reference && <span className="block font-mono text-xs text-muted-foreground">{row.original.reference}</span>}
        </span>
      ),
    },
    {
      id: 'allocations',
      header: 'Allocated to',
      enableSorting: false,
      accessorFn: allocationText,
      cell: ({ row }) => (
        <ul className="text-xs">
          {row.original.allocations.map((a) => (
            <li key={a.productId} className="whitespace-nowrap">{a.productName}: <MoneyText value={a.amountMinor} currency={row.original.currency} /></li>
          ))}
        </ul>
      ),
    },
    { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <PaymentStatus p={row.original} /> },
  );
  if (withMember) cols.push({ id: 'recordedAt', header: 'Recorded', accessorKey: 'recordedAt', cell: ({ row }) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatInstant(row.original.recordedAt)}</span> });
  return cols;
}

export function paymentCsv(digits: number): CsvColumn<PaymentView>[] {
  return [
    { header: 'Date paid', value: (p) => p.paidOn },
    { header: 'Member number', value: (p) => p.memberNumber },
    { header: 'Member', value: (p) => p.memberName },
    { header: 'Amount', value: (p) => csvMoney(p.amountMinor, digits) },
    { header: 'Method', value: (p) => label(p.method) },
    { header: 'Reference', value: (p) => p.reference },
    { header: 'Allocations', value: (p) => p.allocations.map((a) => `${a.productCode}:${csvMoney(a.amountMinor, digits)}`).join('; ') },
    { header: 'Status', value: (p) => p.status },
    { header: 'Reversal reason', value: (p) => p.reversalReason },
    { header: 'Recorded at', value: (p) => p.recordedAt },
  ];
}
