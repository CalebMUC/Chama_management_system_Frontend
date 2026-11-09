'use client';

import type { LoanView } from '@/api/types';
import type { ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, StatusChip } from '@/components/shared/Display';
import { csvMoney, type CsvColumn } from '@/lib/csv';
import { formatDate, memberLabel } from '@/lib/format';

/** Loan book columns (README §7.9). */
export function loanColumns(withBorrower = true): ColumnDef<LoanView, unknown>[] {
  const cols: ColumnDef<LoanView, unknown>[] = [
    { id: 'applied', header: 'Applied', accessorKey: 'appliedOn', cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.appliedOn)}</span> },
  ];
  if (withBorrower) cols.push({ id: 'borrower', header: 'Borrower', accessorFn: (l) => memberLabel(l.borrowerName, l.memberNumber), cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span> });
  cols.push(
    { id: 'product', header: 'Product', accessorKey: 'productName' },
    { id: 'principal', header: 'Principal', accessorKey: 'principalMinor', meta: { numeric: true }, cell: ({ row }) => <MoneyText value={row.original.principalMinor} currency={row.original.currency} /> },
    { id: 'term', header: 'Term', accessorKey: 'termMonths', meta: { numeric: true }, cell: ({ row }) => `${row.original.termMonths} mo` },
    { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusChip status={row.original.status} /> },
    {
      id: 'approvals',
      header: 'Approvals',
      accessorKey: 'approvals',
      meta: { numeric: true },
      cell: ({ row }) => (['PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REPAID'].includes(row.original.status) ? <span className="tabular">{row.original.approvals}/{row.original.requiredApprovals}</span> : '—'),
    },
    { id: 'outstanding', header: 'Outstanding', accessorKey: 'outstandingMinor', meta: { numeric: true }, cell: ({ row }) => <MoneyText value={row.original.outstandingMinor} currency={row.original.currency} /> },
    {
      id: 'arrears',
      header: 'Arrears',
      accessorKey: 'arrearsMinor',
      meta: { numeric: true },
      cell: ({ row }) => <MoneyText value={row.original.arrearsMinor} currency={row.original.currency} className={row.original.arrearsMinor > 0 ? 'font-medium text-destructive' : undefined} />,
    },
    {
      id: 'nextDue',
      header: 'Next due',
      accessorFn: (l) => l.nextDueDate ?? '',
      cell: ({ row }) => (row.original.nextDueDate ? <span className="whitespace-nowrap">{formatDate(row.original.nextDueDate)}</span> : '—'),
    },
  );
  return cols;
}

export function loanCsv(digits: number): CsvColumn<LoanView>[] {
  return [
    { header: 'Applied', value: (l) => l.appliedOn },
    { header: 'Member number', value: (l) => l.memberNumber },
    { header: 'Borrower', value: (l) => l.borrowerName },
    { header: 'Product', value: (l) => l.productName },
    { header: 'Principal', value: (l) => csvMoney(l.principalMinor, digits) },
    { header: 'Interest', value: (l) => csvMoney(l.interestMinor, digits) },
    { header: 'Term (months)', value: (l) => l.termMonths },
    { header: 'Status', value: (l) => l.status },
    { header: 'Approvals', value: (l) => `${l.approvals}/${l.requiredApprovals}` },
    { header: 'Repaid', value: (l) => csvMoney(l.repaidMinor, digits) },
    { header: 'Outstanding', value: (l) => csvMoney(l.outstandingMinor, digits) },
    { header: 'Arrears', value: (l) => csvMoney(l.arrearsMinor, digits) },
    { header: 'Next due', value: (l) => l.nextDueDate },
  ];
}

export function LoanMobileCard({ l }: { l: LoanView }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-medium">{memberLabel(l.borrowerName, l.memberNumber)}</p>
        <p className="text-xs text-muted-foreground">{l.productName} · {formatDate(l.appliedOn)}</p>
      </div>
      <div className="shrink-0 text-right text-sm">
        <StatusChip status={l.status} />
        <p className="mt-1"><MoneyText value={l.status === 'ACTIVE' ? l.outstandingMinor : l.principalMinor} currency={l.currency} /></p>
        {l.arrearsMinor > 0 && <p className="text-xs text-destructive">Arrears <MoneyText value={l.arrearsMinor} currency={l.currency} /></p>}
      </div>
    </div>
  );
}
