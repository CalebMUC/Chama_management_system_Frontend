'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { ledgerApi } from '@/api/endpoints/books';
import type { EntryView, LedgerSourceType } from '@/api/types';
import { Can, Guard } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { Amount } from '@/components/shared/Amount';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { Identifier } from '@/components/shared/Identifier';
import { Button } from '@/components/ui/button';
import { Badge, NativeSelect } from '@/components/ui/primitives';
import { usePaged } from '@/hooks/usePaged';
import { useCurrency } from '@/hooks/useSessionInfo';
import { csvMoney } from '@/lib/csv';
import { formatDate, fractionDigits } from '@/lib/format';
import { label } from '@/lib/labels';

const SOURCES: LedgerSourceType[] = ['CONTRIBUTION', 'PENALTY', 'PENALTY_PAYMENT', 'PENALTY_WAIVER', 'LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'EXPENSE', 'INVESTMENT_FUNDING', 'INVESTMENT_DEPOSIT', 'INVESTMENT_INCOME', 'INVESTMENT_WITHDRAWAL', 'INVESTMENT_CLOSURE', 'OPENING_BALANCE', 'MANUAL', 'REVERSAL'];

const columns: ColumnDef<EntryView, unknown>[] = [
  { id: 'number', header: 'Entry', accessorKey: 'number', meta: { hideable: false }, cell: ({ row }) => <Identifier value={`#${row.original.number}`} label="journal entry number" copy={false} className="font-medium text-primary" /> },
  { id: 'date', header: 'Date', accessorKey: 'entryDate', cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.entryDate)}</span> },
  { id: 'description', header: 'Description', accessorKey: 'description', cell: ({ row }) => <span className="line-clamp-2 min-w-[14rem]">{row.original.description}</span> },
  { id: 'reference', header: 'Reference', accessorFn: (e) => e.reference ?? '', cell: ({ row }) => <Identifier value={row.original.reference} /> },
  {
    id: 'source',
    header: 'Source',
    accessorKey: 'sourceType',
    cell: ({ row }) => (
      <span className="flex flex-wrap gap-1">
        <Badge variant="outline">{label(row.original.sourceType)}</Badge>
        {row.original.reversedByEntryId && <Badge variant="secondary">Reversed</Badge>}
        {row.original.reversesEntryId && <Badge variant="secondary">Reversal</Badge>}
      </span>
    ),
  },
  { id: 'total', header: 'Amount (Dr = Cr)', accessorKey: 'totalMinor', meta: { numeric: true }, cell: ({ row }) => <Amount value={row.original.totalMinor} bare /> },
];

export default function JournalPage() {
  return (
    <Guard permission="LEDGER_VIEW">
      <Journal />
    </Guard>
  );
}

/** README §7.12: every journal entry, newest first. */
function Journal() {
  const router = useRouter();
  const currency = useCurrency();
  const [range, setRange] = useState<DateRangeValue>({});
  const [source, setSource] = useState<LedgerSourceType | ''>('');
  const list = usePaged(['ledger', 'entries'], { from: range.from, to: range.to, sourceType: source || undefined }, ledgerApi.entries);
  const digits = fractionDigits(currency);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Journal"
        description="Every entry in the books. Entries are never edited: mistakes are reversed."
        actions={<Can permission="LEDGER_POST"><Button asChild><Link href="/ledger/journal/new"><Plus />Manual entry</Link></Button></Can>}
      />
      <DataTable
        columns={columns}
        getRowId={(e) => e.id}
        onRowClick={(e) => router.push(`/ledger/journal/${e.id}`)}
        emptyTitle="No entries"
        columnToggle
        toolbar={
          <>
            <DateRangeFilter value={range} onChange={setRange} />
            <NativeSelect value={source} onChange={(e) => setSource(e.target.value as LedgerSourceType | '')} className="w-52" aria-label="Source">
              <option value="">All sources</option>
              {SOURCES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
            </NativeSelect>
          </>
        }
        csv={{
          fileName: 'journal',
          columns: [
            { header: 'Number', value: (e) => e.number },
            { header: 'Date', value: (e) => e.entryDate },
            { header: 'Description', value: (e) => e.description },
            { header: 'Reference', value: (e) => e.reference },
            { header: 'Source', value: (e) => e.sourceType },
            { header: 'Total', value: (e) => csvMoney(e.totalMinor, digits) },
            { header: 'Lines', value: (e) => e.lines.map((l) => `${l.accountCode} ${l.debitMinor ? `Dr ${csvMoney(l.debitMinor, digits)}` : `Cr ${csvMoney(l.creditMinor, digits)}`}`).join('; ') },
          ],
        }}
        mobileCard={(e) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">#{e.number} · {formatDate(e.entryDate)}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{e.description}</p>
            </div>
            <div className="shrink-0 text-right"><MoneyText value={e.totalMinor} /><div className="mt-1"><Badge variant="outline">{label(e.sourceType)}</Badge></div></div>
          </div>
        )}
        {...list.table}
      />
    </div>
  );
}
