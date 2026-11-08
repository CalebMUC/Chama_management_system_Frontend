'use client';

import type { PenaltyView } from '@/api/types';
import type { ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, StatusChip } from '@/components/shared/Display';
import { csvMoney, type CsvColumn } from '@/lib/csv';
import { formatDate, memberLabel } from '@/lib/format';
import { label } from '@/lib/labels';

/** Penalty columns (README §7.8). */
export function penaltyColumns(withMember: boolean): ColumnDef<PenaltyView, unknown>[] {
  const money = (key: keyof PenaltyView, header: string, red = false): ColumnDef<PenaltyView, unknown> => ({
    id: key,
    header,
    accessorKey: key,
    meta: { align: 'right' },
    cell: ({ row }) => {
      const v = row.original[key] as number;
      return <MoneyText value={v} currency={row.original.currency} className={red && v > 0 ? 'font-medium text-destructive' : undefined} />;
    },
  });
  const cols: ColumnDef<PenaltyView, unknown>[] = [{ id: 'assessedOn', header: 'Assessed', accessorKey: 'assessedOn', cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.assessedOn)}</span> }];
  if (withMember) cols.push({ id: 'member', header: 'Member', accessorFn: (p) => memberLabel(p.memberName, p.memberNumber) });
  cols.push(
    { id: 'kind', header: 'Kind', accessorKey: 'kind', cell: ({ row }) => label(row.original.kind) },
    { id: 'description', header: 'Description', accessorKey: 'description', cell: ({ row }) => <span className="line-clamp-2 min-w-[12rem]">{row.original.description}</span> },
    money('amountMinor', 'Amount'),
    money('paidMinor', 'Paid'),
    money('waivedMinor', 'Waived'),
    money('outstandingMinor', 'Outstanding', true),
    { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusChip status={row.original.status} /> },
  );
  return cols;
}

export function penaltyCsv(digits: number): CsvColumn<PenaltyView>[] {
  return [
    { header: 'Assessed on', value: (p) => p.assessedOn },
    { header: 'Member number', value: (p) => p.memberNumber },
    { header: 'Member', value: (p) => p.memberName },
    { header: 'Kind', value: (p) => label(p.kind) },
    { header: 'Description', value: (p) => p.description },
    { header: 'Amount', value: (p) => csvMoney(p.amountMinor, digits) },
    { header: 'Paid', value: (p) => csvMoney(p.paidMinor, digits) },
    { header: 'Waived', value: (p) => csvMoney(p.waivedMinor, digits) },
    { header: 'Outstanding', value: (p) => csvMoney(p.outstandingMinor, digits) },
    { header: 'Status', value: (p) => p.status },
  ];
}

export function PenaltyCard({ p, withMember }: { p: PenaltyView; withMember?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium">{label(p.kind)}{withMember && <span className="font-normal text-muted-foreground"> · {memberLabel(p.memberName, p.memberNumber)}</span>}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">{formatDate(p.assessedOn)} · {p.description}</p>
      </div>
      <div className="shrink-0 text-right text-sm">
        <StatusChip status={p.status} />
        <p className="mt-1"><MoneyText value={p.outstandingMinor} currency={p.currency} className={p.outstandingMinor > 0 ? 'text-destructive' : undefined} /></p>
      </div>
    </div>
  );
}
