'use client';

import { useQuery } from '@tanstack/react-query';
import { Gavel } from 'lucide-react';
import { penaltiesApi } from '@/api/endpoints/penalties';
import { Guard } from '@/components/shared/Can';
import { DataTable } from '@/components/shared/DataTable';
import { MoneyText, PageHeader, StatCard } from '@/components/shared/Display';
import { PenaltyCard, penaltyColumns } from '@/features/penalties/penaltyColumns';

export default function MyPenaltiesPage() {
  return (
    <Guard feature="PENALTIES">
      <MyPenalties />
    </Guard>
  );
}

function MyPenalties() {
  const q = useQuery({ queryKey: ['penalties', 'me'], queryFn: penaltiesApi.mine });
  return (
    <div className="space-y-5">
      <PageHeader title="My penalties" description="Late-contribution penalties and fines. Pay them to an official, who records the payment." />
      {q.data && (
        <div className="max-w-sm">
          <StatCard label="Outstanding" value={<MoneyText value={q.data.outstandingMinor} currency={q.data.currency} />} icon={<Gavel />} tone={q.data.outstandingMinor > 0 ? 'destructive' : 'success'} />
        </div>
      )}
      <DataTable
        columns={penaltyColumns(false)}
        data={q.data?.penalties}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => q.refetch()}
        getRowId={(p) => p.id}
        emptyTitle="No penalties"
        emptyMessage="Keep it that way: pay contributions by the due date."
        mobileCard={(p) => <PenaltyCard p={p} />}
      />
    </div>
  );
}
