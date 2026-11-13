'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Gavel, Send } from 'lucide-react';
import { penaltiesApi } from '@/api/endpoints/penalties';
import type { PenaltyView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, StatCard } from '@/components/shared/Display';
import { Button } from '@/components/ui/button';
import { PenaltyCard, penaltyColumns } from '@/features/penalties/penaltyColumns';
import { reportPaymentHref } from '@/features/submissions/submissionLinks';
import { useCan } from '@/hooks/useSessionInfo';

export default function MyPenaltiesPage() {
  return (
    <Guard feature="PENALTIES">
      <MyPenalties />
    </Guard>
  );
}

function MyPenalties() {
  const q = useQuery({ queryKey: ['penalties', 'me'], queryFn: penaltiesApi.mine });
  const canReport = useCan()('PAYMENT_SUBMIT');
  // "I've paid this" opens the payment report form with this penalty chosen (README §7.8).
  const columns = useMemo<ColumnDef<PenaltyView, unknown>[]>(
    () => [...penaltyColumns(false), ...(canReport ? [{ id: 'report', header: '', cell: ({ row }) => <PaidThis p={row.original} /> } as ColumnDef<PenaltyView, unknown>] : [])],
    [canReport],
  );
  return (
    <div className="space-y-5">
      <PageHeader title="My penalties" description="Late-contribution penalties and fines. Paid one? Tell the treasurer with “I’ve paid this”; it clears once they confirm it." />
      {q.data && (
        <div className="max-w-sm">
          <StatCard label="Outstanding" value={<MoneyText value={q.data.outstandingMinor} currency={q.data.currency} />} icon={<Gavel />} tone={q.data.outstandingMinor > 0 ? 'destructive' : 'success'} />
        </div>
      )}
      <DataTable
        columns={columns}
        data={q.data?.penalties}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        getRowId={(p) => p.id}
        emptyTitle="No penalties"
        emptyMessage="Keep it that way: pay contributions by the due date."
        mobileCard={(p) => (
          <div className="space-y-2">
            <PenaltyCard p={p} />
            {canReport && <PaidThis p={p} />}
          </div>
        )}
      />
    </div>
  );
}

function PaidThis({ p }: { p: PenaltyView }) {
  if (p.status !== 'OUTSTANDING' || p.outstandingMinor <= 0) return null;
  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={reportPaymentHref({ kind: 'PENALTY_PAYMENT', targetId: p.id })}><Send />I&apos;ve paid this</Link>
    </Button>
  );
}
