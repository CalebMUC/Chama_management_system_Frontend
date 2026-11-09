'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, Briefcase, CheckCircle2, HandCoins, PiggyBank, RefreshCw, Users, Wallet } from 'lucide-react';
import { dashboardApi } from '@/api/endpoints/books';
import type { ChamaDashboardView, PerformanceSection } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { Guard } from '@/components/shared/Can';
import { BarList } from '@/components/shared/Charts';
import { EntryLink, PageHeader, Progress, StatCard } from '@/components/shared/Display';
import { Identifier } from '@/components/shared/Identifier';
import { KpiStrip } from '@/components/shared/Kpi';
import { KeyValue, Panel } from '@/components/shared/Panel';
import { ErrorState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Badge, Skeleton, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { useCan } from '@/hooks/useSessionInfo';
import { formatBp, formatDate, formatPeriodKey } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';

export default function ChamaOverviewPage() {
  return (
    <Guard permission="REPORT_VIEW_ALL">
      <Overview />
    </Guard>
  );
}

const panelLink = 'inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline';

/** README §7.4, as an operations dashboard. Sections for unlicensed features are null and hidden. */
function Overview() {
  const q = useQuery({ queryKey: ['dashboard', 'chama'], queryFn: dashboardApi.chama, refetchOnWindowFocus: true });
  const can = useCan();
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-72" />
        <KpiStrip>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</KpiStrip>
        <div className="grid gap-3 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      </div>
    );
  }
  const d = q.data;
  const c = d.currency;
  return (
    <div className="space-y-3">
      <PageHeader
        title="Operations dashboard"
        description={<>{d.chamaName} · Business date {formatDate(d.asOf)}</>}
        asAt={d.generatedAt}
        actions={<Button variant="outline" size="sm" onClick={() => q.refetch()} loading={q.isFetching}><RefreshCw />Refresh</Button>}
      />

      <KpiStrip>
        <StatCard label="Members" value={d.members.active} hint={`${d.members.suspended} suspended · ${d.members.pendingApplications} applying`} icon={<Users />} href="/members" />
        <StatCard label="Cash position" value={<Amount value={d.cash.totalMinor} currency={c} />} hint="Cash, bank and M-Pesa" icon={<Wallet />} />
        {d.savings && <StatCard label="Total savings" value={<Amount value={d.savings.totalMinor} currency={c} />} hint={`${d.savings.products.length} products`} icon={<PiggyBank />} tone="success" href="/member-accounts" />}
        {d.loans && (
          <StatCard
            label="Loan book"
            value={<Amount value={d.loans.outstandingMinor} currency={c} />}
            hint={<>{d.loans.activeLoans} active · PAR30 {formatBp(d.loans.par30BasisPoints)}</>}
            icon={<HandCoins />}
            tone={d.loans.par30BasisPoints > 1000 ? 'destructive' : d.loans.par30BasisPoints > 500 ? 'warning' : 'default'}
            href="/loans"
          />
        )}
        {d.investments && <StatCard label="Investments" value={<Amount value={d.investments.marketValueMinor} currency={c} />} hint={`${d.investments.active} active · market value`} icon={<Briefcase />} href="/investments/portfolio" />}
      </KpiStrip>

      <div className="grid items-start gap-3 lg:grid-cols-3">
        <ApprovalsQueue d={d} />
        <CashPosition d={d} />
        {d.loans && <LoanBook d={d} />}
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-3">
        {d.contributions && <Collections d={d} />}
        <IncomeExpenses d={d} />
        {d.savings && d.savings.products.length > 0 && (
          <Panel title="Savings by product" actions={<Link href="/member-accounts" className={panelLink}>Accounts<ArrowRight className="size-3.5" aria-hidden /></Link>}>
            <BarList items={d.savings.products.map((p) => ({ key: p.productId, label: p.name, value: p.balanceMinor, hint: p.code }))} currency={c} />
          </Panel>
        )}
      </div>

      <Panel
        title="Recent journal entries"
        flush
        actions={can('LEDGER_VIEW') && <Link href="/ledger/journal" className={panelLink}>Journal<ArrowRight className="size-3.5" aria-hidden /></Link>}
      >
        {d.recentEntries.length === 0 ? <p className="p-[var(--panel-p)] text-sm text-muted-foreground">No entries yet.</p> : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20">Entry</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="hidden md:table-cell">Reference</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Amount (Dr = Cr)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.recentEntries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><EntryLink id={e.id} number={e.number} /></TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(e.entryDate)}</TableCell>
                  <TableCell className="min-w-[14rem]"><span className="line-clamp-1">{e.description}</span></TableCell>
                  <TableCell className="hidden md:table-cell">{e.reference ? <Identifier value={e.reference} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      <Badge variant="outline">{label(e.sourceType)}</Badge>
                      {e.reversal && <Badge variant="secondary">Reversal</Badge>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right"><Amount value={e.totalMinor} currency={c} bare /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

/** One row per work queue, with its count and a link to the pre-filtered list. Unlicensed queues (null) are left out. */
function ApprovalsQueue({ d }: { d: ChamaDashboardView }) {
  const p = d.pending;
  const rows = [
    { n: p.membershipApplications, text: 'Membership applications', href: '/members?status=PENDING_APPROVAL' },
    { n: p.loansAwaitingApproval, text: 'Loans awaiting approval', href: '/loans?status=PENDING_APPROVAL' },
    { n: p.loansAwaitingDisbursement, text: 'Loans awaiting disbursement', href: '/loans?status=APPROVED' },
    { n: p.expensesAwaitingApproval, text: 'Expenses awaiting approval', href: '/expenses?status=PENDING_APPROVAL' },
    { n: p.expensesAwaitingPayment, text: 'Expenses awaiting payment', href: '/expenses?status=APPROVED' },
    { n: p.investmentsAwaitingApproval, text: 'Investments awaiting approval', href: '/investments?status=PROPOSED' },
  ].filter((r): r is { n: number; text: string; href: string } => r.n !== null);
  const total = rows.reduce((s, r) => s + r.n, 0);
  return (
    <Panel title="Approvals queue" flush actions={<span className="text-xs text-muted-foreground tabular">{total} waiting</span>}>
      {total === 0 && (
        <p className="flex items-center gap-2 border-b px-[var(--panel-p)] py-2 text-sm text-success"><CheckCircle2 className="size-4" aria-hidden />Nothing is waiting for action.</p>
      )}
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.href} className="flex items-center gap-2 px-[var(--panel-p)] py-2 text-sm">
            <span className={cn('min-w-7 rounded-sm px-1 text-center text-xs font-semibold tabular', r.n > 0 ? 'bg-gold/25 text-foreground' : 'bg-muted text-muted-foreground')}>{r.n}</span>
            <span className={cn('flex-1', r.n === 0 && 'text-muted-foreground')}>{r.text}</span>
            <Link href={r.href} className={panelLink}>Go to queue<ArrowRight className="size-3.5" aria-hidden /><span className="sr-only">: {r.text}</span></Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Cash by channel. */
function CashPosition({ d }: { d: ChamaDashboardView }) {
  const c = d.currency;
  const rows = [
    { label: 'Cash on hand', value: d.cash.cashOnHandMinor },
    { label: 'Bank', value: d.cash.bankMinor },
    { label: 'M-Pesa', value: d.cash.mobileMoneyMinor },
  ];
  return (
    <Panel title="Cash position" flush actions={<span className="text-xs text-muted-foreground">{c}</span>}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Channel</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="w-16 text-right">Share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label}>
              <TableCell>{r.label}</TableCell>
              <TableCell className="text-right"><Amount value={r.value} currency={c} bare /></TableCell>
              <TableCell className="text-right tabular text-muted-foreground">{d.cash.totalMinor > 0 ? `${Math.round((r.value / d.cash.totalMinor) * 100)}%` : '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow className="hover:bg-transparent">
            <TableCell>Total</TableCell>
            <TableCell className="text-right"><Amount value={d.cash.totalMinor} currency={c} bare /></TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </Panel>
  );
}

/** PAR30: amber above 5%, red above 10% (README §7.4), with an icon and words so colour isn't the only signal. */
function Par30({ bp }: { bp: number }) {
  const level = bp > 1000 ? 'High' : bp > 500 ? 'Watch' : 'Healthy';
  const tone = bp > 1000 ? 'text-destructive' : bp > 500 ? 'text-warning-text' : 'text-success';
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold', tone)}>
      {bp > 500 ? <AlertTriangle className="size-3.5" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />}
      {formatBp(bp)} <span className="font-normal">· {level}</span>
    </span>
  );
}

function LoanBook({ d }: { d: ChamaDashboardView }) {
  const l = d.loans!;
  const c = d.currency;
  return (
    <Panel title="Loan book" actions={<Link href="/loans" className={panelLink}>Loans<ArrowRight className="size-3.5" aria-hidden /></Link>}>
      <KeyValue
        items={[
          { label: 'Portfolio at risk (30 days)', value: <Par30 bp={l.par30BasisPoints} /> },
          { label: 'Outstanding', value: <Amount value={l.outstandingMinor} currency={c} /> },
          { label: `Arrears · ${l.loansInArrears} loan${l.loansInArrears === 1 ? '' : 's'}`, value: <Amount value={l.arrearsMinor} currency={c} className={l.arrearsMinor > 0 ? 'text-destructive' : undefined} /> },
          { label: 'Active loans', value: l.activeLoans },
        ]}
      />
      <p className="mb-1.5 mt-3 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Pipeline</p>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/loans?status=PENDING_APPROVAL" className="rounded-md border px-2.5 py-2 hover:bg-accent/50">
          <span className="block text-lg font-semibold tabular">{l.awaitingApproval}</span>
          <span className="text-xs text-muted-foreground">To approve</span>
        </Link>
        <Link href="/loans?status=APPROVED" className="rounded-md border px-2.5 py-2 hover:bg-accent/50">
          <span className="block text-lg font-semibold tabular">{l.awaitingDisbursement}</span>
          <span className="text-xs text-muted-foreground">To disburse</span>
        </Link>
      </div>
    </Panel>
  );
}

function Collections({ d }: { d: ChamaDashboardView }) {
  const k = d.contributions!;
  const c = d.currency;
  const done = k.collectionRateBasisPoints >= 10_000;
  return (
    <Panel title={`Collections · ${formatPeriodKey(k.currentPeriod)}`} actions={<Link href="/contributions/periods" className={panelLink}>Periods<ArrowRight className="size-3.5" aria-hidden /></Link>}>
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span><Amount value={k.collectedMinor} currency={c} className="font-semibold" /> <span className="text-muted-foreground">of</span> <Amount value={k.expectedMinor} currency={c} /></span>
          <span className="font-semibold tabular">{formatBp(k.collectionRateBasisPoints)}</span>
        </div>
        <Progress value={k.collectionRateBasisPoints} max={10_000} tone={done ? 'success' : 'warning'} label="Collection rate" />
        {k.dueDate && <p className="text-xs text-muted-foreground">Due {formatDate(k.dueDate)}</p>}
      </div>
      <KeyValue
        className="mt-2"
        items={[
          { label: 'Members paid', value: k.membersPaid },
          { label: 'Paid late', value: k.membersLate },
          { label: <Link href="/contributions/standings" className="hover:underline">Members in arrears</Link>, value: k.membersInArrears },
          { label: 'Total arrears', value: <Amount value={k.arrearsMinor} currency={c} className={k.arrearsMinor > 0 ? 'text-destructive' : undefined} /> },
        ]}
      />
    </Panel>
  );
}

/** This month against year to date, as a compact table. */
function IncomeExpenses({ d }: { d: ChamaDashboardView }) {
  const c = d.currency;
  const cols: { title: string; p: PerformanceSection }[] = [{ title: 'This month', p: d.thisMonth }, { title: 'Year to date', p: d.yearToDate }];
  const rows: { label: string; pick: (p: PerformanceSection) => number; strong?: boolean }[] = [
    { label: 'Income', pick: (p) => p.incomeMinor },
    { label: 'Expenses', pick: (p) => p.expensesMinor },
    { label: 'Surplus / (deficit)', pick: (p) => p.surplusMinor, strong: true },
  ];
  return (
    <Panel title="Income and expenses" flush>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead />
            {cols.map((col) => (
              <TableHead key={col.title} className="text-right" title={`${formatDate(col.p.from)} – ${formatDate(col.p.to)}`}>{col.title}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.label} className={cn(r.strong && 'border-t-2 font-semibold')}>
              <TableCell>{r.label}</TableCell>
              {cols.map((col) => <TableCell key={col.title} className="text-right"><Amount value={r.pick(col.p)} currency={c} bare /></TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {(d.penaltiesOutstandingMinor !== null || d.investments) && (
        <KeyValue
          className="border-t px-[var(--panel-p)]"
          items={[
            d.penaltiesOutstandingMinor !== null && { label: 'Penalties outstanding', value: <Amount value={d.penaltiesOutstandingMinor} currency={c} /> },
            d.investments && { label: 'Investment income', value: <Amount value={d.investments.incomeMinor} currency={c} /> },
            d.investments && { label: 'Invested', value: <Amount value={d.investments.investedMinor} currency={c} /> },
          ]}
        />
      )}
    </Panel>
  );
}
