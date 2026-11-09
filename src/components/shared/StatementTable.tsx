'use client';

import { Badge, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { useCurrency } from '@/hooks/useSessionInfo';
import { formatDate } from '@/lib/format';
import { label } from '@/lib/labels';
import { Amount } from './Amount';
import { EntryLink } from './Display';
import { Identifier } from './Identifier';
import { EmptyState } from './States';

export interface StatementLine {
  entryId?: string;
  entryNumber: number;
  date: string;
  description: string;
  reference: string | null;
  sourceType: string;
  debitMinor: number;
  creditMinor: number;
  balanceMinor: number;
  memo?: string | null;
}

/**
 * A statement of account: opening balance, every movement with its running balance, closing balance. Figures are bare in
 * columns headed with the currency, as on a bank statement. Entry numbers link to the journal when an id is known.
 */
export function StatementTable({ lines, opening, closing, currency, linkEntries = false }: {
  lines: StatementLine[];
  opening: number;
  closing: number;
  currency?: string;
  linkEntries?: boolean;
}) {
  const chamaCurrency = useCurrency();
  const cur = currency ?? chamaCurrency;
  const debits = lines.reduce((s, l) => s + l.debitMinor, 0);
  const credits = lines.reduce((s, l) => s + l.creditMinor, 0);
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-28">Date</TableHead>
            <TableHead className="w-20">Entry</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead className="text-right">Debit ({cur})</TableHead>
            <TableHead className="text-right">Credit ({cur})</TableHead>
            <TableHead className="text-right">Balance ({cur})</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-panel-header/60 hover:bg-panel-header/60">
            <TableCell colSpan={6} className="font-medium">Opening balance</TableCell>
            <TableCell className="text-right font-medium"><Amount value={opening} currency={cur} bare /></TableCell>
          </TableRow>
          {lines.length === 0 && (
            <TableRow className="hover:bg-transparent"><TableCell colSpan={7}><EmptyState title="No movements in this period" className="py-6" /></TableCell></TableRow>
          )}
          {lines.map((l, i) => (
            <TableRow key={`${l.entryNumber}-${i}`}>
              <TableCell className="whitespace-nowrap">{formatDate(l.date)}</TableCell>
              <TableCell>{linkEntries && l.entryId ? <EntryLink id={l.entryId} number={l.entryNumber} /> : <span className="ident text-muted-foreground">#{l.entryNumber}</span>}</TableCell>
              <TableCell className="min-w-[12rem]">
                <span className="block">{l.description}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="h-4 text-[10px]">{label(l.sourceType)}</Badge>
                  {l.memo && <span>{l.memo}</span>}
                </span>
              </TableCell>
              <TableCell>{l.reference ? <Identifier value={l.reference} /> : ''}</TableCell>
              <TableCell className="text-right">{l.debitMinor ? <Amount value={l.debitMinor} currency={cur} bare /> : ''}</TableCell>
              <TableCell className="text-right">{l.creditMinor ? <Amount value={l.creditMinor} currency={cur} bare /> : ''}</TableCell>
              <TableCell className="text-right"><Amount value={l.balanceMinor} currency={cur} bare /></TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={4}>Closing balance · {lines.length} transaction{lines.length === 1 ? '' : 's'}</TableCell>
            <TableCell className="text-right"><Amount value={debits} currency={cur} bare /></TableCell>
            <TableCell className="text-right"><Amount value={credits} currency={cur} bare /></TableCell>
            <TableCell className="text-right"><Amount value={closing} currency={cur} bare /></TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
