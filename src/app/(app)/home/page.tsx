'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard } from 'lucide-react';
import { dashboardApi } from '@/api/endpoints/books';
import { PageHeader } from '@/components/shared/Display';
import { ErrorState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitives';
import { AccountTiles, BalanceHero, MiniStatement, Obligations, QuickActions } from '@/features/home/MemberHome';
import { useCan, useHasFeature } from '@/hooks/useSessionInfo';
import { memberLabel } from '@/lib/format';
import { label } from '@/lib/labels';
import { useSession } from '@/stores/session';

/**
 * README §7.3: the member's home, laid out as "My accounts" in a banking app. Sections are null when the licence lacks the
 * feature; only non-null ones render.
 */
export default function HomePage() {
  const can = useCan();
  const hasFeature = useHasFeature();
  // Select the stored array and filter outside the selector: a new array on every call makes zustand re-render forever.
  const memberRoles = useSession((s) => s.membership?.roles);
  const roles = (memberRoles ?? []).filter((r) => r !== 'MEMBER');
  const q = useQuery({ queryKey: ['dashboard', 'me'], queryFn: dashboardApi.mine, refetchOnWindowFocus: true });
  const d = q.data;

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!d) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-32" />
        <div className="grid gap-3 lg:grid-cols-3"><Skeleton className="h-56 lg:col-span-2" /><Skeleton className="h-56" /></div>
      </div>
    );
  }

  // A compact identity line: name · member number · roles.
  const identity = [memberLabel(d.memberName, null), d.memberNumber ? `Member #${d.memberNumber}` : null, roles.length ? roles.map(label).join(', ') : 'Member']
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-3">
      <PageHeader
        title="My accounts"
        description={identity}
        actions={can('REPORT_VIEW_ALL') && <Button variant="outline" size="sm" asChild><Link href="/chama"><LayoutDashboard />Operations dashboard</Link></Button>}
      />
      <BalanceHero d={d} />
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="min-w-0 space-y-3">
          <AccountTiles d={d} />
          {hasFeature('REPORTS') && <MiniStatement currency={d.currency} />}
        </div>
        <div className="min-w-0 space-y-3">
          <Obligations d={d} />
          <QuickActions d={d} />
        </div>
      </div>
    </div>
  );
}
