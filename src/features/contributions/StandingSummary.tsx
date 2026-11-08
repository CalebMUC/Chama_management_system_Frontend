'use client';

import type { StandingView } from '@/api/types';
import { MoneyText, SignedMoney } from '@/components/shared/Display';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';

/** A member's contribution standing: paid vs due to date, arrears, advance (README §7.6). */
export function StandingSummary({ standing }: { standing: StandingView }) {
  const c = standing.currency;
  const tiles = [
    { label: 'Total paid', value: <MoneyText value={standing.totalPaidMinor} currency={c} /> },
    { label: 'Due to date', value: <MoneyText value={standing.dueToDateMinor} currency={c} /> },
    { label: 'Arrears', value: <MoneyText value={standing.arrearsMinor} currency={c} className={standing.arrearsMinor > 0 ? 'text-destructive' : undefined} /> },
    { label: 'Advance', value: <MoneyText value={standing.advanceMinor} currency={c} /> },
    { label: 'Balance', value: <SignedMoney value={standing.balanceMinor} currency={c} /> },
    { label: 'Late periods', value: standing.latePeriods },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className="mt-0.5 font-semibold">{t.value}</p>
          </div>
        ))}
      </div>
      {standing.products.length > 1 && <ProductBreakdown standing={standing} />}
    </div>
  );
}

export function ProductBreakdown({ standing }: { standing: StandingView }) {
  const c = standing.currency;
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Due to date</TableHead>
            <TableHead className="text-right">Arrears</TableHead>
            <TableHead className="text-right">Advance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {standing.products.map((p) => (
            <TableRow key={p.productId}>
              <TableCell>{p.productName} <span className="text-xs text-muted-foreground">{p.productCode}</span></TableCell>
              <TableCell className="text-right"><MoneyText value={p.totalPaidMinor} currency={c} /></TableCell>
              <TableCell className="text-right"><MoneyText value={p.dueToDateMinor} currency={c} /></TableCell>
              <TableCell className="text-right"><MoneyText value={p.arrearsMinor} currency={c} className={p.arrearsMinor > 0 ? 'text-destructive' : undefined} /></TableCell>
              <TableCell className="text-right"><MoneyText value={p.advanceMinor} currency={c} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
