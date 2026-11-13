'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Send } from 'lucide-react';
import { dashboardApi, dashboardKeys } from '@/api/endpoints/books';
import { normaliseError } from '@/api/errors';
import { PageHeader } from '@/components/shared/Display';
import { ErrorState, NotFoundState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/primitives';
import { MyContributionsCard, MyLoansCard, MyPenaltiesCard, NetPositionHero, OurInvestments, PendingReports } from '@/features/home/MemberCards';
import { AccountTiles, MiniStatement, QuickActions } from '@/features/home/MemberHome';
import { REPORT_PAYMENT_PATH } from '@/features/submissions/submissionLinks';
import { useCan, useHasFeature } from '@/hooks/useSessionInfo';
import { label } from '@/lib/labels';
import { useSession } from '@/stores/session';

/**
 * GET /dashboard/me (DASHBOARDS.md "Member home"): every active member lands here, officials included. It leads with the net
 * position, then one card per licensed section; null sections are hidden.
 */
export default function HomePage() {
  const can = useCan();
  const hasFeature = useHasFeature();
  // Select the stored array and filter outside the selector: a new array on every call makes zustand re-render forever.
  const memberRoles = useSession((s) => s.membership?.roles);
  const roles = (memberRoles ?? []).filter((r) => r !== 'MEMBER');
  const q = useQuery({ queryKey: dashboardKeys.me, queryFn: dashboardApi.mine, refetchOnWindowFocus: true });
  const d = q.data;

  if (q.error && !d) {
    // No active seat any more (e.g. just suspended).
    if (normaliseError(q.error).code === 'REPORT_MEMBER_NOT_FOUND') {
      return (
        <NotFoundState
          title="Your membership is not active"
          message="Your seat in this chama is no longer active. Ask your officials if you think this is a mistake."
          action={<Button variant="outline" size="sm" asChild><Link href="/membership-status">See membership status</Link></Button>}
        />
      );
    }
    return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  }
  if (!d) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-32" />
        <div className="grid gap-3 lg:grid-cols-3"><Skeleton className="h-56 lg:col-span-2" /><Skeleton className="h-56" /></div>
      </div>
    );
  }

  const firstName = d.memberName?.trim().split(/\s+/)[0];
  // A compact identity line: member number · roles · chama.
  const identity = [d.memberNumber ? `Member #${d.memberNumber}` : null, roles.length ? roles.map(label).join(', ') : 'Member', d.chamaName]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-3">
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : 'Hello'}
        description={identity}
        actions={
          <>
            {can('CHAMA_VIEW') && <Button variant="outline" size="sm" asChild><Link href="/chama"><LayoutDashboard />Chama overview</Link></Button>}
            {can('PAYMENT_SUBMIT') && <Button size="sm" asChild><Link href={REPORT_PAYMENT_PATH}><Send />Report a payment</Link></Button>}
          </>
        }
      />
      <NetPositionHero d={d} />
      <PendingReports d={d} />
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="min-w-0 space-y-3">
          <AccountTiles d={d} />
          <MyLoansCard d={d} />
          {hasFeature('REPORTS') && <MiniStatement currency={d.currency} />}
        </div>
        <div className="min-w-0 space-y-3">
          <MyContributionsCard d={d} />
          <MyPenaltiesCard d={d} />
          <OurInvestments d={d} />
          <QuickActions d={d} />
        </div>
      </div>
    </div>
  );
}
