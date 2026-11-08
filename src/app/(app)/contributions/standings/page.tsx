'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { contributionsApi } from '@/api/endpoints/savings';
import type { StandingView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, SignedMoney } from '@/components/shared/Display';
import { Switch } from '@/components/ui/overlays';
import { Label } from '@/components/ui/primitives';
import { ProductBreakdown } from '@/features/contributions/StandingSummary';
import { useCurrency } from '@/hooks/useSessionInfo';
import { csvMoney } from '@/lib/csv';
import { fractionDigits, memberLabel } from '@/lib/format';

const money = (key: keyof StandingView, header: string, red = false): ColumnDef<StandingView, unknown> => ({
  id: key,
  header,
  accessorKey: key,
  meta: { align: 'right' },
  cell: ({ row }) => {
    const v = row.original[key] as number;
    return <MoneyText value={v} currency={row.original.currency} className={red && v > 0 ? 'font-medium text-destructive' : undefined} />;
  },
});

const columns: ColumnDef<StandingView, unknown>[] = [
  { id: 'member', header: 'Member', accessorFn: (s) => memberLabel(s.memberName, s.memberNumber), cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span> },
  money('totalPaidMinor', 'Total paid'),
  money('dueToDateMinor', 'Due to date'),
  money('arrearsMinor', 'Arrears', true),
  money('advanceMinor', 'Advance'),
  { id: 'balance', header: 'Balance', accessorKey: 'balanceMinor', meta: { align: 'right' }, cell: ({ row }) => <SignedMoney value={row.original.balanceMinor} currency={row.original.currency} /> },
  { id: 'late', header: 'Late periods', accessorKey: 'latePeriods', meta: { align: 'right' } },
];

export default function StandingsPage() {
  return (
    <Guard permission="CONTRIBUTION_VIEW_ALL" feature="CONTRIBUTIONS">
      <Standings />
    </Guard>
  );
}

/** README §7.6: each member's position. Click a row for the per-product breakdown. */
function Standings() {
  const [arrearsOnly, setArrearsOnly] = useState(false);
  const currency = useCurrency();
  const q = useQuery({ queryKey: ['contributions', 'standings', arrearsOnly], queryFn: () => contributionsApi.standings(arrearsOnly) });
  const digits = fractionDigits(currency);
  const totalArrears = (q.data ?? []).reduce((s, x) => s + x.arrearsMinor, 0);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Standings"
        description={q.data && <>Total arrears <MoneyText value={totalArrears} className="font-medium text-destructive" /> across {q.data.filter((s) => s.arrearsMinor > 0).length} members</>}
      />
      <DataTable
        columns={columns}
        data={q.data}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        getRowId={(s) => s.memberUserId}
        searchable
        searchPlaceholder="Find a member"
        pageSize={50}
        renderExpanded={(s) => <ProductBreakdown standing={s} />}
        emptyTitle={arrearsOnly ? 'Nobody is in arrears' : 'No members'}
        toolbar={
          <div className="flex items-center gap-2">
            <Switch id="arrears-only" checked={arrearsOnly} onCheckedChange={setArrearsOnly} />
            <Label htmlFor="arrears-only">Only in arrears</Label>
          </div>
        }
        csv={{
          fileName: 'contribution-standings',
          columns: [
            { header: 'Member number', value: (s) => s.memberNumber },
            { header: 'Member', value: (s) => s.memberName },
            { header: 'Total paid', value: (s) => csvMoney(s.totalPaidMinor, digits) },
            { header: 'Due to date', value: (s) => csvMoney(s.dueToDateMinor, digits) },
            { header: 'Arrears', value: (s) => csvMoney(s.arrearsMinor, digits) },
            { header: 'Advance', value: (s) => csvMoney(s.advanceMinor, digits) },
            { header: 'Balance', value: (s) => csvMoney(s.balanceMinor, digits) },
            { header: 'Late periods', value: (s) => s.latePeriods },
          ],
        }}
        mobileCard={(s) => (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{memberLabel(s.memberName, s.memberNumber)}</p>
              <p className="text-xs text-muted-foreground">Paid <MoneyText value={s.totalPaidMinor} currency={s.currency} /> · {s.latePeriods} late</p>
            </div>
            <SignedMoney value={s.balanceMinor} currency={s.currency} />
          </div>
        )}
      />
    </div>
  );
}
