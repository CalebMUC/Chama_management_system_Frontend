'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarRange, Gavel, HandCoins, LayoutDashboard, PiggyBank } from 'lucide-react';
import { dashboardApi } from '@/api/endpoints/books';
import { MoneyText, PageHeader, StatusChip } from '@/components/shared/Display';
import { ErrorState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@/components/ui/primitives';
import { useCan } from '@/hooks/useSessionInfo';
import { formatDate, formatInstant, formatPeriodKey, memberLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

function HomeCard({ title, icon, children, footer, className }: { title: string; icon: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex-row items-center gap-2 space-y-0 pb-3">
        <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary [&_svg]:size-4">{icon}</span>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-3">{children}</CardContent>
      {footer && <div className="flex flex-wrap gap-2 border-t px-6 py-3">{footer}</div>}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

/** README §7.3. Sections are null when the licence lacks the feature; only non-null ones render. */
export default function HomePage() {
  const can = useCan();
  const q = useQuery({ queryKey: ['dashboard', 'me'], queryFn: dashboardApi.mine, refetchOnWindowFocus: true });
  const d = q.data;

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!d) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      </div>
    );
  }

  const firstName = d.memberName?.split(' ')[0];
  return (
    <div className="space-y-5">
      <PageHeader
        title={`Hello${firstName ? `, ${firstName}` : ''}`}
        description={<>{memberLabel(d.memberName, d.memberNumber)} · {d.chamaName}</>}
        actions={can('REPORT_VIEW_ALL') && <Button variant="outline" asChild><Link href="/chama"><LayoutDashboard />Chama overview</Link></Button>}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {d.savings && (
          <HomeCard title="My savings" icon={<PiggyBank />} footer={<Button variant="ghost" size="sm" asChild><Link href="/me/savings">All accounts<ArrowRight /></Link></Button>}>
            <p className="text-2xl font-semibold"><MoneyText value={d.savings.totalMinor} currency={d.currency} /></p>
            <ul className="divide-y">
              {d.savings.accounts.map((a) => (
                <li key={a.accountId}>
                  <Link href={`/me/savings/${a.accountId}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:text-primary">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.productName}</span>
                      <span className="block text-xs text-muted-foreground">{a.accountNumber}{!a.active && ' · closed'}</span>
                    </span>
                    <MoneyText value={a.balanceMinor} currency={d.currency} />
                  </Link>
                </li>
              ))}
              {d.savings.accounts.length === 0 && <li className="py-2 text-sm text-muted-foreground">No savings accounts yet.</li>}
            </ul>
          </HomeCard>
        )}

        {d.contributions && (
          <HomeCard title="Contributions" icon={<CalendarRange />} footer={<Button variant="ghost" size="sm" asChild><Link href="/me/contributions">View contributions<ArrowRight /></Link></Button>}>
            <Row label="Current period">
              <span className="flex items-center justify-end gap-2">
                {formatPeriodKey(d.contributions.currentPeriod)}
                {d.contributions.currentPeriodStatus && <StatusChip status={d.contributions.currentPeriodStatus} />}
              </span>
            </Row>
            <Row label="Arrears"><MoneyText value={d.contributions.arrearsMinor} currency={d.currency} className={d.contributions.arrearsMinor > 0 ? 'text-destructive' : undefined} /></Row>
            <Row label="Paid in advance"><MoneyText value={d.contributions.advanceMinor} currency={d.currency} /></Row>
            <Row label="Total paid"><MoneyText value={d.contributions.totalPaidMinor} currency={d.currency} /></Row>
            <Row label="Late periods">{d.contributions.latePeriods}</Row>
          </HomeCard>
        )}

        {d.loans && (
          <HomeCard
            title="Loans"
            icon={<HandCoins />}
            footer={
              <>
                <Button variant="ghost" size="sm" asChild><Link href="/me/loans">My loans<ArrowRight /></Link></Button>
                {can('LOAN_APPLY') && <Button size="sm" asChild><Link href="/me/loans/apply">Apply for a loan</Link></Button>}
                {d.loans.guaranteeRequests > 0 && <Button size="sm" variant="secondary" asChild><Link href="/me/guarantees">Respond to {d.loans.guaranteeRequests} guarantee request{d.loans.guaranteeRequests === 1 ? '' : 's'}</Link></Button>}
              </>
            }
          >
            <Row label="Active loans">{d.loans.activeLoans}</Row>
            <Row label="Outstanding"><MoneyText value={d.loans.outstandingMinor} currency={d.currency} /></Row>
            <Row label="Arrears"><MoneyText value={d.loans.arrearsMinor} currency={d.currency} className={d.loans.arrearsMinor > 0 ? 'text-destructive' : undefined} /></Row>
            <Row label="Next payment">{d.loans.nextDueDate ? <><MoneyText value={d.loans.nextDueMinor} currency={d.currency} /> on {formatDate(d.loans.nextDueDate)}</> : '—'}</Row>
            {d.loans.inProgress > 0 && <Row label="Applications in progress">{d.loans.inProgress}</Row>}
          </HomeCard>
        )}

        {d.penaltiesOutstandingMinor !== null && (
          <HomeCard title="Penalties" icon={<Gavel />} footer={<Button variant="ghost" size="sm" asChild><Link href="/me/penalties">My penalties<ArrowRight /></Link></Button>}>
            <Row label="Outstanding">
              <MoneyText value={d.penaltiesOutstandingMinor} currency={d.currency} className={d.penaltiesOutstandingMinor > 0 ? 'text-destructive' : undefined} />
            </Row>
            <p className="text-xs text-muted-foreground">Pay outstanding penalties to an official, who records the payment.</p>
          </HomeCard>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Updated {formatInstant(d.generatedAt)}</p>
    </div>
  );
}
