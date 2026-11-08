'use client';

import { Badge, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { formatDate } from '@/lib/format';
import { label } from '@/lib/labels';
import { EntryLink, MoneyText } from './Display';
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

/** Opening balance, lines with running balance, closing balance. Entry numbers link to the journal when an id is known. */
export function StatementTable({ lines, opening, closing, currency, linkEntries = false }: {
  lines: StatementLine[];
  opening: number;
  closing: number;
  currency?: string;
  linkEntries?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Date</TableHead>
            <TableHead>Entry</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableCell colSpan={5} className="font-medium">Opening balance</TableCell>
            <TableCell className="text-right font-medium"><MoneyText value={opening} currency={currency} /></TableCell>
          </TableRow>
          {lines.length === 0 && (
            <TableRow className="hover:bg-transparent"><TableCell colSpan={6}><EmptyState title="No movements in this period" className="py-6" /></TableCell></TableRow>
          )}
          {lines.map((l, i) => (
            <TableRow key={`${l.entryNumber}-${i}`}>
              <TableCell className="whitespace-nowrap">{formatDate(l.date)}</TableCell>
              <TableCell>{linkEntries && l.entryId ? <EntryLink id={l.entryId} number={l.entryNumber} /> : `#${l.entryNumber}`}</TableCell>
              <TableCell className="min-w-[14rem]">
                <span className="block">{l.description}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{label(l.sourceType)}</Badge>
                  {l.reference && <span>Ref {l.reference}</span>}
                  {l.memo && <span>· {l.memo}</span>}
                </span>
              </TableCell>
              <TableCell className="text-right">{l.debitMinor ? <MoneyText value={l.debitMinor} currency={currency} /> : ''}</TableCell>
              <TableCell className="text-right">{l.creditMinor ? <MoneyText value={l.creditMinor} currency={currency} /> : ''}</TableCell>
              <TableCell className="text-right"><MoneyText value={l.balanceMinor} currency={currency} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={5}>Closing balance</TableCell>
            <TableCell className="text-right"><MoneyText value={closing} currency={currency} /></TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
