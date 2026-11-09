'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Briefcase, CheckCircle2, HandCoins, PiggyBank, RefreshCw, Users, Wallet } from 'lucide-react';
import { dashboardApi } from '@/api/endpoints/books';
import type { ChamaDashboardView, PerformanceSection } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { BarList } from '@/components/shared/Charts';
import { EntryLink, MoneyText, PageHeader, Progress, Section, StatCard } from '@/components/shared/Display';
import { KpiStrip } from '@/components/shared/Kpi';
import { ErrorState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Badge, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { useCan } from '@/hooks/useSessionInfo';
import { formatBp, formatDate, formatInstant, formatPeriodKey } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';

export default function ChamaOverviewPage() {
  return (
    <Guard permission="REPORT_VIEW_ALL">
      <Overview />
    </Guard>
  );
}

/** README §7.4. Sections for unlicensed features are null and hidden. */
function Overview() {
  const q = useQuery({ queryKey: ['dashboard', 'chama'], queryFn: dashboardApi.chama, refetchOnWindowFocus: true });
  const can = useCan();
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <KpiStrip>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</KpiStrip>
        <Skeleton className="h-64" />
      </div>
    );
  }
  const d = q.data;
  const c = d.currency;
  return (
    <div className="space-y-5">
      <PageHeader
        title={d.chamaName}
        description={<>As of {formatDate(d.asOf)} · generated {formatInstant(d.generatedAt)}</>}
        actions={<Button variant="outline" size="sm" onClick={() => q.refetch()} loading={q.isFetching}><RefreshCw />Refresh</Button>}
      />

      <KpiStrip>
        <StatCard label="Active members" value={d.members.active} hint={`${d.members.suspended} suspended · ${d.members.pendingApplications} applying`} icon={<Users />} href="/members" />
        <StatCard
          label="Cash"
          value={<MoneyText value={d.cash.totalMinor} currency={c} />}
          hint={<>Hand <MoneyText value={d.cash.cashOnHandMinor} currency={c} /> · Bank <MoneyText value={d.cash.bankMinor} currency={c} /> · M-Pesa <MoneyText value={d.cash.mobileMoneyMinor} currency={c} /></>}
          icon={<Wallet />}
        />
        {d.savings && <StatCard label="Total savings" value={<MoneyText value={d.savings.totalMinor} currency={c} />} icon={<PiggyBank />} tone="success" href="/member-accounts" />}
        {d.loans && <StatCard label="Loans outstanding" value={<MoneyText value={d.loans.outstandingMinor} currency={c} />} hint={`${d.loans.activeLoans} active`} icon={<HandCoins />} href="/loans" />}
        {d.investments && <StatCard label="Investments" value={<MoneyText value={d.investments.marketValueMinor} currency={c} />} hint={`${d.investments.active} active · market value`} icon={<Briefcase />} href="/investments/portfolio" />}
      </KpiStrip>

      <NeedsAttention d={d} />

      <div className="grid gap-5 lg:grid-cols-2">
        {d.contributions && (
          <Section title="Contributions" actions={<Button variant="ghost" size="sm" asChild><Link href="/contributions/periods">Periods<ArrowRight /></Link></Button>}>
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">{formatPeriodKey(d.contributions.currentPeriod)}</span>
                {d.contributions.dueDate && <span className="text-sm text-muted-foreground">Due {formatDate(d.contributions.dueDate)}</span>}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span><MoneyText value={d.contributions.collectedMinor} currency={c} className="font-semibold" /> of <MoneyText value={d.contributions.expectedMinor} currency={c} /></span>
                  <span className="font-medium">{formatBp(d.contributions.collectionRateBasisPoints)}</span>
                </div>
                <Progress value={d.contributions.collectionRateBasisPoints} max={10_000} tone={d.contributions.collectionRateBasisPoints >= 10_000 ? 'success' : 'warning'} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Fig label="Members paid" value={d.contributions.membersPaid} />
                <Fig label="Paid late" value={d.contributions.membersLate} />
                <Fig label="Total arrears" value={<MoneyText value={d.contributions.arrearsMinor} currency={c} className={d.contributions.arrearsMinor > 0 ? 'text-destructive' : undefined} />} />
                <Fig label="Members in arrears" value={<Link href="/contributions/standings" className="hover:underline">{d.contributions.membersInArrears}</Link>} />
              </div>
            </div>
          </Section>
        )}

        {d.loans && (
          <Section title="Loans" actions={<Button variant="ghost" size="sm" asChild><Link href="/loans">Loan book<ArrowRight /></Link></Button>}>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Fig label="Active loans" value={d.loans.activeLoans} />
              <Fig label="Outstanding" value={<MoneyText value={d.loans.outstandingMinor} currency={c} />} />
              <Fig label="Arrears" value={<MoneyText value={d.loans.arrearsMinor} currency={c} className={d.loans.arrearsMinor > 0 ? 'text-destructive' : undefined} />} />
              <Fig label="Loans in arrears" value={d.loans.loansInArrears} />
              <Fig label="PAR30" value={<Par30 bp={d.loans.par30BasisPoints} />} />
              <Fig label="Pipeline" value={`${d.loans.awaitingApproval} to approve · ${d.loans.awaitingDisbursement} to disburse`} />
            </div>
          </Section>
        )}

        {d.savings && d.savings.products.length > 0 && (
          <Section title="Savings by product">
            <BarList items={d.savings.products.map((p) => ({ key: p.productId, label: p.name, value: p.balanceMinor, hint: p.code }))} currency={c} />
          </Section>
        )}

        <Section title="Income and expenses">
          <div className="grid gap-4 sm:grid-cols-2">
            <Performance title="This month" p={d.thisMonth} currency={c} />
            <Performance title="Year to date" p={d.yearToDate} currency={c} />
          </div>
          {d.penaltiesOutstandingMinor !== null && (
            <p className="mt-4 text-sm text-muted-foreground">Penalties outstanding: <MoneyText value={d.penaltiesOutstandingMinor} currency={c} className="text-foreground" /></p>
          )}
          {d.investments && (
            <p className="mt-1 text-sm text-muted-foreground">Investment income: <MoneyText value={d.investments.incomeMinor} currency={c} className="text-foreground" /> on <MoneyText value={d.investments.investedMinor} currency={c} className="text-foreground" /> invested</p>
          )}
        </Section>
      </div>

      <Section title="Recent ledger entries" actions={can('LEDGER_VIEW') &&<Button variant="ghost" size="sm" asChild><Link href="/ledger/journal">Journal<ArrowRight /></Link></Button>}>
        {d.recentEntries.length === 0 ? <p className="text-sm text-muted-foreground">No entries yet.</p> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.recentEntries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell><EntryLink id={e.id} number={e.number} /></TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(e.entryDate)}</TableCell>
                    <TableCell className="min-w-[14rem]">{e.description}{e.reference && <span className="block text-xs text-muted-foreground">Ref {e.reference}</span>}</TableCell>
                    <TableCell><span className="flex flex-wrap gap-1"><Badge variant="outline">{label(e.sourceType)}</Badge>{e.reversal && <Badge variant="secondary">Reversal</Badge>}</span></TableCell>
                    <TableCell className="text-right"><MoneyText value={e.totalMinor} currency={c} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Fig({ label: text, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{text}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

/** PAR30: amber above 5%, red above 10% (README §7.4), with an icon so colour isn't the only signal. */
function Par30({ bp }: { bp: number }) {
  const tone = bp > 1000 ? 'text-destructive' : bp > 500 ? 'text-warning' : 'text-success';
  return (
    <span className={cn('inline-flex items-center gap-1', tone)}>
      {bp > 500 ? <AlertTriangle className="size-3.5" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />}
      {formatBp(bp)}
    </span>
  );
}

function Performance({ title, p, currency }: { title: string; p: PerformanceSection; currency: string }) {
  const deficit = p.surplusMinor < 0;
  return (
    <div className="space-y-1.5 rounded-md border p-3 text-sm">
      <p className="font-medium">{title} <span className="text-xs font-normal text-muted-foreground">{formatDate(p.from)} – {formatDate(p.to)}</span></p>
      <div className="flex justify-between"><span className="text-muted-foreground">Income</span><MoneyText value={p.incomeMinor} currency={currency} /></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Expenses</span><MoneyText value={p.expensesMinor} currency={currency} /></div>
      <div className="flex justify-between border-t pt-1.5 font-medium">
        <span>{deficit ? 'Deficit' : 'Surplus'}</span>
        <MoneyText value={p.surplusMinor} currency={currency} />
      </div>
    </div>
  );
}

function NeedsAttention({ d }: { d: ChamaDashboardView }) {
  const p = d.pending;
  const items = [
    { n: p.membershipApplications, text: 'membership applications', href: '/members?status=PENDING_APPROVAL' },
    { n: p.loansAwaitingApproval, text: 'loans awaiting approval', href: '/loans?status=PENDING_APPROVAL' },
    { n: p.loansAwaitingDisbursement, text: 'loans awaiting disbursement', href: '/loans?status=APPROVED' },
    { n: p.expensesAwaitingApproval, text: 'expenses awaiting approval', href: '/expenses?status=PENDING_APPROVAL' },
    { n: p.expensesAwaitingPayment, text: 'expenses awaiting payment', href: '/expenses?status=APPROVED' },
    { n: p.investmentsAwaitingApproval, text: 'investments awaiting approval', href: '/investments?status=PROPOSED' },
  ].filter((i) => (i.n ?? 0) > 0);
  if (items.length === 0) {
    return <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm"><CheckCircle2 className="size-4 text-success" />Nothing is waiting for action.</div>;
  }
  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium"><AlertTriangle className="size-4 text-warning" />Needs attention</p>
      <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-warning/10">
              <span className="min-w-6 rounded-full bg-warning/20 px-1.5 text-center text-xs font-semibold tabular">{i.n}</span>
              {i.text}
              <ArrowRight className="ml-auto size-3.5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
