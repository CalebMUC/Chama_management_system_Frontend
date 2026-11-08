'use client';

import type { ReactNode } from 'react';
import type { ReportSection } from '@/api/types';
import { MoneyText } from '@/components/shared/Display';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/primitives';
import { csvMoney } from '@/lib/csv';

/** A titled block of statement lines with its total (financial position, income statement). */
export function SectionTable({ title, section, currency, totalLabel }: { title: string; section: ReportSection; currency: string; totalLabel?: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b bg-muted/50 px-4 py-2 text-sm font-semibold">{title}</div>
      <Table>
        <TableBody>
          {section.lines.length === 0 && <TableRow className="hover:bg-transparent"><TableCell className="text-sm text-muted-foreground">None</TableCell></TableRow>}
          {section.lines.map((l, i) => (
            <TableRow key={`${l.code}-${i}`}>
              <TableCell className="w-20 font-mono text-xs text-muted-foreground">{l.code ?? ''}</TableCell>
              <TableCell>{l.name}</TableCell>
              <TableCell className="text-right"><MoneyText value={l.amountMinor} currency={currency} /></TableCell>
            </TableRow>
          ))}
          <TableRow className="border-t-2 font-semibold hover:bg-transparent">
            <TableCell colSpan={2}>{totalLabel ?? `Total ${title.toLowerCase()}`}</TableCell>
            <TableCell className="text-right"><MoneyText value={section.totalMinor} currency={currency} /></TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

/** Rows for CSV export of named sections. */
export function sectionRows(sections: { name: string; section: ReportSection }[], digits: number) {
  return sections.flatMap(({ name, section }) => [
    ...section.lines.map((l) => ({ section: name, code: l.code ?? '', name: l.name, amount: csvMoney(l.amountMinor, digits) })),
    { section: name, code: '', name: `Total ${name.toLowerCase()}`, amount: csvMoney(section.totalMinor, digits) },
  ]);
}

export const SECTION_CSV = [
  { header: 'Section', value: (r: { section: string }) => r.section },
  { header: 'Code', value: (r: { code: string }) => r.code },
  { header: 'Name', value: (r: { name: string }) => r.name },
  { header: 'Amount', value: (r: { amount: number | string }) => r.amount },
];
