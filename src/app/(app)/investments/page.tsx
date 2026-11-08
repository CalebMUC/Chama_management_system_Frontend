'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BarChart3, Plus } from 'lucide-react';
import { investmentsApi } from '@/api/endpoints/spending';
import type { InvestmentStatus, InvestmentType, InvestmentView } from '@/api/types';
import { Can, Guard } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, StatusChip } from '@/components/shared/Display';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/primitives';
import { INVESTMENT_TYPES, ProposeDialog } from '@/features/investments/ProposeDialog';
import { usePaged } from '@/hooks/usePaged';
import { useCurrency } from '@/hooks/useSessionInfo';
import { csvMoney } from '@/lib/csv';
import { formatBp, formatDate, fractionDigits } from '@/lib/format';
import { label } from '@/lib/labels';

const STATUSES: InvestmentStatus[] = ['PROPOSED', 'APPROVED', 'ACTIVE', 'CLOSED', 'REJECTED', 'CANCELLED'];

const columns: ColumnDef<InvestmentView, unknown>[] = [
  { id: 'name', header: 'Name', accessorKey: 'name', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  { id: 'type', header: 'Type', accessorKey: 'type', cell: ({ row }) => label(row.original.type) },
  { id: 'institution', header: 'Institution', accessorFn: (i) => i.institution ?? '', cell: ({ row }) => row.original.institution ?? '—' },
  { id: 'amount', header: 'Amount', accessorKey: 'amountMinor', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.amountMinor} currency={row.original.currency} /> },
  { id: 'book', header: 'Book value', accessorKey: 'bookValueMinor', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.bookValueMinor} currency={row.original.currency} /> },
  { id: 'market', header: 'Market value', accessorKey: 'marketValueMinor', meta: { align: 'right' }, cell: ({ row }) => <MoneyText value={row.original.marketValueMinor} currency={row.original.currency} /> },
  {
    id: 'return',
    header: 'Return',
    accessorFn: (i) => i.performance?.returnBasisPoints ?? -Infinity,
    meta: { align: 'right' },
    cell: ({ row }) => {
      const p = row.original.performance;
      if (!p) return '—';
      return <span className={p.returnBasisPoints < 0 ? 'text-destructive' : 'text-success'}>{formatBp(p.returnBasisPoints)}</span>;
    },
  },
  { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => <StatusChip status={row.original.status} /> },
  { id: 'maturity', header: 'Matures', accessorFn: (i) => i.maturityDate ?? '', cell: ({ row }) => (row.original.maturityDate ? formatDate(row.original.maturityDate) : '—') },
];

export default function InvestmentsPage() {
  return (
    <Guard permission="INVESTMENT_VIEW" feature="INVESTMENTS">
      <Investments />
    </Guard>
  );
}

/** README §7.11. */
function Investments() {
  const router = useRouter();
  const params = useSearchParams();
  const currency = useCurrency();
  const [status, setStatus] = useState<InvestmentStatus | ''>((params.get('status') as InvestmentStatus | null) ?? '');
  const [type, setType] = useState<InvestmentType | ''>('');
  const [proposing, setProposing] = useState(false);
  const list = usePaged(['investments', 'list'], { status: status || undefined, type: type || undefined }, investmentsApi.list);
  const digits = fractionDigits(currency);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Investments"
        description="Where the chama puts its money to work."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/investments/portfolio"><BarChart3 />Portfolio</Link></Button>
            <Can permission="INVESTMENT_MANAGE"><Button onClick={() => setProposing(true)}><Plus />Propose</Button></Can>
          </>
        }
      />
      <DataTable
        columns={columns}
        getRowId={(i) => i.id}
        onRowClick={(i) => router.push(`/investments/${i.id}`)}
        emptyTitle="No investments"
        toolbar={
          <>
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as InvestmentStatus | '')} className="w-40" aria-label="Status">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </NativeSelect>
            <NativeSelect value={type} onChange={(e) => setType(e.target.value as InvestmentType | '')} className="w-48" aria-label="Type">
              <option value="">All types</option>
              {INVESTMENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
            </NativeSelect>
          </>
        }
        csv={{
          fileName: 'investments',
          columns: [
            { header: 'Name', value: (i) => i.name },
            { header: 'Type', value: (i) => label(i.type) },
            { header: 'Institution', value: (i) => i.institution },
            { header: 'Amount', value: (i) => csvMoney(i.amountMinor, digits) },
            { header: 'Book value', value: (i) => csvMoney(i.bookValueMinor, digits) },
            { header: 'Market value', value: (i) => csvMoney(i.marketValueMinor, digits) },
            { header: 'Income', value: (i) => csvMoney(i.incomeMinor, digits) },
            { header: 'Return %', value: (i) => (i.performance ? i.performance.returnBasisPoints / 100 : '') },
            { header: 'Status', value: (i) => i.status },
            { header: 'Funded on', value: (i) => i.fundedOn },
            { header: 'Matures', value: (i) => i.maturityDate },
          ],
        }}
        mobileCard={(i) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{i.name}</p>
              <p className="text-xs text-muted-foreground">{label(i.type)}{i.institution && ` · ${i.institution}`}</p>
            </div>
            <div className="shrink-0 text-right">
              <MoneyText value={i.status === 'ACTIVE' ? i.marketValueMinor : i.amountMinor} currency={i.currency} className="font-medium" />
              <div className="mt-1"><StatusChip status={i.status} /></div>
            </div>
          </div>
        )}
        {...list.table}
      />
      <ProposeDialog open={proposing} onOpenChange={setProposing} onCreated={(id) => router.push(`/investments/${id}`)} />
    </div>
  );
}
