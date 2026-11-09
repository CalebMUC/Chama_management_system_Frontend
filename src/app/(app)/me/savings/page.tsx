'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, PiggyBank } from 'lucide-react';
import { memberAccountsApi } from '@/api/endpoints/savings';
import { Guard } from '@/components/shared/Can';
import { MoneyText, PageHeader, StatCard, StatusChip } from '@/components/shared/Display';
import { Identifier } from '@/components/shared/Identifier';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/States';
import { formatDate } from '@/lib/format';
import { label } from '@/lib/labels';

export default function MySavingsPage() {
  return (
    <Guard feature="CONTRIBUTIONS">
      <MySavings />
    </Guard>
  );
}

function MySavings() {
  const q = useQuery({ queryKey: ['memberAccounts', 'me'], queryFn: memberAccountsApi.mine });
  return (
    <div className="space-y-5">
      <PageHeader title="My savings" description="Your balance in each of the chama's savings products." />
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? <LoadingState /> : (
        <>
          <div className="max-w-sm"><StatCard label="Total savings" value={<MoneyText value={q.data.totalBalanceMinor} currency={q.data.currency} />} icon={<PiggyBank />} tone="success" /></div>
          {q.data.accounts.length === 0 ? <EmptyState title="No savings accounts yet" message="Accounts open when you are approved and when you join a savings product." /> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {q.data.accounts.map((a) => (
                <Link key={a.id} href={`/me/savings/${a.id}`} className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.productName}</p>
                      <p className="text-xs text-muted-foreground"><Identifier value={a.accountNumber} label="account number" sensitive copy={false} /> · {label(a.productKind)}</p>
                    </div>
                    <StatusChip status={a.status} />
                  </div>
                  <p className="mt-3 text-xl font-semibold"><MoneyText value={a.balanceMinor} currency={a.currency} /></p>
                  <p className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    Opened {formatDate(a.openedOn)}
                    <span className="flex items-center text-primary opacity-0 transition-opacity group-hover:opacity-100">Statement<ChevronRight className="size-3" /></span>
                  </p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
