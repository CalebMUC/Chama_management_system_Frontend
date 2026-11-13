'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ChamaDashboardView, ChamaOverviewView, PerformanceSection } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { BarList } from '@/components/shared/Charts';
import { Progress } from '@/components/shared/Display';
import { KeyValue, Panel } from '@/components/shared/Panel';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { useCan } from '@/hooks/useSessionInfo';
import { formatBp, formatDate, formatPeriodKey, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ReturnFigure, seeAllLink } from './Ranked';

// The section cards of the chama overview (DASHBOARDS.md "Chama overview" and "for members"). Each takes either view (the
// officials' ChamaDashboardView has every field of the members' ChamaOverviewView); the page renders a card
// only when its section is non-null (licensed). A licensed section with no activity shows zeros and empty states.

const PanelLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className={seeAllLink}>{children}<ArrowRight className="size-3.5" aria-hidden /></Link>
);

/** Amount in red when above zero (arrears, amounts owed). */
const Owed = ({ value, currency }: { value: number; currency: string }) => <Amount value={value} currency={currency} className={value > 0 ? 'text-destructive' : undefined} />;

/** PAR30: amber above 5%, red above 10%, with an icon and a word so colour is never the only signal. */
export function Par30({ bp }: { bp: number }) {
  const level = bp > 1000 ? 'High' : bp > 500 ? 'Watch' : 'Healthy';
  const tone = bp > 1000 ? 'text-destructive' : bp > 500 ? 'text-warning-text' : 'text-success';
  return (
    <span className={cn('inline-flex items-center gap-1 font-semibold', tone)}>
      {bp > 500 ? <AlertTriangle className="size-3.5" aria-hidden /> : <CheckCircle2 className="size-3.5" aria-hidden />}
      {formatBp(bp)} <span className="font-normal">· {level}</span>
    </span>
  );
}
export const par30Tone = (bp: number) => (bp > 1000 ? 'destructive' : bp > 500 ? 'warning' : 'default') as 'destructive' | 'warning' | 'default';

/** A small uppercase label between groups of rows inside a card. */
const SubHead = ({ children }: { children: ReactNode }) => <p className="mb-1 mt-3 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{children}</p>;

interface AttentionRow {
  key: string;
  n: number;
  text: string;
  detail?: string;
  href?: string;
}

/** "Needs attention": one row per non-zero work queue, linking to its filtered list. Null (unlicensed) counts are skipped. */
export function NeedsAttention({ d }: { d: ChamaDashboardView }) {
  const p = d.pending;
  const split = [
    p.contributionsAwaitingReview && plural(p.contributionsAwaitingReview, 'contribution'),
    p.penaltyPaymentsAwaitingReview && plural(p.penaltyPaymentsAwaitingReview, 'penalty payment'),
    p.loanRepaymentsAwaitingReview && plural(p.loanRepaymentsAwaitingReview, 'loan repayment'),
  ].filter(Boolean).join(' · ');
  const rows: AttentionRow[] = [
    { key: 'applications', n: p.membershipApplications, text: 'Membership applications', href: '/members?status=PENDING_APPROVAL' },
    // No review-queue screen yet: the row shows the count and the split without a link.
    { key: 'payments', n: p.paymentsAwaitingReview, text: 'Reported payments to review', detail: split || undefined },
    { key: 'loanApproval', n: p.loansAwaitingApproval ?? 0, text: 'Loans awaiting approval', href: '/loans?status=PENDING_APPROVAL' },
    { key: 'loanDisburse', n: p.loansAwaitingDisbursement ?? 0, text: 'Loans awaiting disbursement', href: '/loans?status=APPROVED' },
    { key: 'expenseApproval', n: p.expensesAwaitingApproval ?? 0, text: 'Expenses awaiting approval', href: '/expenses?status=PENDING_APPROVAL' },
    { key: 'expensePayment', n: p.expensesAwaitingPayment ?? 0, text: 'Expenses awaiting payment', href: '/expenses?status=APPROVED' },
    { key: 'investments', n: p.investmentsAwaitingApproval ?? 0, text: 'Investments awaiting approval', href: '/investments?status=PROPOSED' },
  ].filter((r) => r.n > 0);
  const total = rows.reduce((s, r) => s + r.n, 0);
  return (
    <Panel title="Needs attention" flush actions={<span className="text-xs text-muted-foreground tabular">{total} waiting</span>}>
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 px-[var(--panel-p)] py-3 text-sm text-success"><CheckCircle2 className="size-4" aria-hidden />Nothing is waiting for action.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => {
            const body = (
              <>
                <span className="min-w-7 rounded-sm bg-gold/25 px-1 text-center text-xs font-semibold tabular">{r.n}</span>
                <span className="min-w-0 flex-1">
                  <span className="block">{r.text}</span>
                  {r.detail && <span className="block text-xs text-muted-foreground">{r.detail}</span>}
                </span>
                {r.href && <ArrowRight className="size-3.5 shrink-0 text-primary" aria-hidden />}
              </>
            );
            const cls = 'flex items-center gap-2 px-[var(--panel-p)] py-2 text-sm';
            return (
              <li key={r.key}>
                {r.href ? <Link href={r.href} className={cn(cls, 'hover:bg-accent/50 focus-visible:bg-accent focus-visible:outline-none')}>{body}</Link> : <div className={cls}>{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function MembersCard({ d }: { d: ChamaOverviewView }) {
  const m = d.members;
  const can = useCan();
  return (
    <Panel title="Members" actions={can('MEMBER_VIEW') && <PanelLink href="/members">Members</PanelLink>}>
      <p className="text-2xl font-semibold leading-tight">{m.active.toLocaleString('en-KE')} <span className="text-sm font-normal text-muted-foreground">active</span></p>
      <p className="mt-0.5 text-xs text-muted-foreground">{m.suspended} suspended · {plural(m.pendingApplications, 'pending application')}</p>
      <KeyValue
        className="mt-2"
        items={[
          { label: 'Joined this month', value: m.joinedThisMonth },
          { label: 'Joined this year', value: m.joinedThisYear },
        ]}
      />
    </Panel>
  );
}

export function ContributionsCard({ d }: { d: ChamaOverviewView }) {
  const k = d.contributions!;
  const c = d.currency;
  const can = useCan();
  return (
    <Panel
      title={k.currentPeriod ? `Contributions · ${formatPeriodKey(k.currentPeriod)}` : 'Contributions'}
      actions={can('CONTRIBUTION_VIEW_ALL') && <PanelLink href="/contributions/periods">Periods</PanelLink>}
    >
      {k.currentPeriod === null ? (
        <p className="text-sm text-muted-foreground">No contribution period yet.</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span><Amount value={k.collectedMinor} currency={c} className="font-semibold" /> <span className="text-muted-foreground">of</span> <Amount value={k.expectedMinor} currency={c} /></span>
            <span className="font-semibold tabular">{formatBp(k.collectionRateBasisPoints)}</span>
          </div>
          <Progress value={k.collectionRateBasisPoints} max={10_000} tone={k.collectionRateBasisPoints >= 10_000 ? 'success' : 'warning'} label="Collected against expected" />
          <p className="text-xs text-muted-foreground">
            {k.dueDate ? `Due ${formatDate(k.dueDate)} · ` : ''}{k.membersPaid} paid · {k.membersLate} late
          </p>
        </div>
      )}
      <KeyValue
        className="mt-2"
        items={[
          { label: can('CONTRIBUTION_VIEW_ALL') ? <Link href="/contributions/standings" className="hover:underline">Arrears · {plural(k.membersInArrears, 'member')}</Link> : `Arrears · ${plural(k.membersInArrears, 'member')}`, value: <Owed value={k.arrearsMinor} currency={c} /> },
          { label: `This month · ${plural(k.paymentsThisMonth, 'payment')}`, value: <Amount value={k.collectedThisMonthMinor} currency={c} /> },
          { label: 'This year', value: <Amount value={k.collectedYearToDateMinor} currency={c} /> },
          { label: 'Compliance', value: formatBp(k.complianceRateBasisPoints) },
        ]}
      />
    </Panel>
  );
}

export function LoansCard({ d }: { d: ChamaOverviewView }) {
  const l = d.loans!;
  const c = d.currency;
  const can = useCan();
  return (
    <Panel title="Loans" flush actions={can('LOAN_VIEW_ALL') && <PanelLink href="/loans">Loans</PanelLink>}>
      <div className="px-[var(--panel-p)] pt-1">
        <KeyValue
          items={[
            { label: 'Portfolio at risk (30 days)', value: <Par30 bp={l.par30BasisPoints} /> },
            { label: `Outstanding · ${plural(l.activeLoans, 'active loan')}`, value: <Amount value={l.outstandingMinor} currency={c} /> },
            { label: `Arrears · ${plural(l.loansInArrears, 'loan')}`, value: <Owed value={l.arrearsMinor} currency={c} /> },
            { label: `Disbursed this year · ${plural(l.disbursedYearToDate, 'loan')}`, value: <Amount value={l.disbursedYearToDateMinor} currency={c} /> },
            { label: 'Total disbursed', value: <Amount value={l.totalDisbursedMinor} currency={c} /> },
            { label: `Total repaid · ${plural(l.repaidLoans, 'loan')} cleared`, value: <Amount value={l.totalRepaidMinor} currency={c} /> },
            { label: 'Interest expected', value: <Amount value={l.interestExpectedMinor} currency={c} /> },
          ]}
        />
        <p className="border-t py-2 text-xs text-muted-foreground">
          {plural(l.dueNext7Days, 'instalment')} due this week (<Amount value={l.dueNext7DaysMinor} currency={c} />)
        </p>
      </div>
      {l.aging.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Ageing</TableHead>
              <TableHead className="text-right">Loans</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-right">Arrears</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {l.aging.map((b) => (
              <TableRow key={b.bucket}>
                <TableCell className="whitespace-nowrap">{b.label}</TableCell>
                <TableCell className="text-right tabular">{b.loans}</TableCell>
                <TableCell className="text-right"><Amount value={b.outstandingMinor} currency={c} bare /></TableCell>
                <TableCell className="text-right"><Amount value={b.arrearsMinor} currency={c} bare className={b.arrearsMinor > 0 ? 'text-destructive' : undefined} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}

export function PenaltiesCard({ d }: { d: ChamaOverviewView }) {
  const p = d.penalties!;
  const c = d.currency;
  const can = useCan();
  return (
    <Panel title="Penalties" actions={can('PENALTY_VIEW_ALL') && <PanelLink href="/penalties">Penalties</PanelLink>}>
      <p className="text-xl font-semibold leading-tight"><Owed value={p.outstandingMinor} currency={c} /></p>
      <p className="mt-0.5 text-xs text-muted-foreground">Owed now · {plural(p.outstandingCount, 'penalty', 'penalties')} · {plural(p.membersOwing, 'member')}</p>
      <SubHead>This year</SubHead>
      <KeyValue
        items={[
          { label: 'Assessed', value: <Amount value={p.assessedYearToDateMinor} currency={c} /> },
          { label: <span className="pl-3">Late contributions</span>, value: <Amount value={p.lateContributionYearToDateMinor} currency={c} /> },
          { label: <span className="pl-3">Fines</span>, value: <Amount value={p.finesYearToDateMinor} currency={c} /> },
          { label: 'Collected', value: <Amount value={p.collectedYearToDateMinor} currency={c} /> },
          { label: 'Waived', value: <Amount value={p.waivedYearToDateMinor} currency={c} /> },
        ]}
      />
      {p.topOwing.length > 0 && (
        <>
          <SubHead>Owing the most</SubHead>
          <ul className="divide-y text-sm">
            {p.topOwing.map((m) => (
              <li key={m.memberUserId} className="flex items-baseline justify-between gap-2 py-1.5">
                <Link href={`/members/${m.memberUserId}`} className="min-w-0 truncate hover:underline">
                  {m.name ?? 'Unknown member'}{m.memberNumber ? <span className="text-muted-foreground"> #{m.memberNumber}</span> : null}
                  <span className="text-xs text-muted-foreground"> · {m.count}</span>
                </Link>
                <Amount value={m.amountMinor} currency={c} className="shrink-0 text-destructive" />
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

export function InvestmentsCard({ d }: { d: ChamaOverviewView }) {
  const i = d.investments!;
  const c = d.currency;
  const can = useCan();
  return (
    <Panel title="Investments" actions={can('INVESTMENT_VIEW') && <PanelLink href="/investments/portfolio">Portfolio</PanelLink>}>
      <KeyValue
        items={[
          { label: `Invested · ${plural(i.active, 'active investment')}`, value: <Amount value={i.investedMinor} currency={c} /> },
          { label: 'Market value', value: <Amount value={i.marketValueMinor} currency={c} /> },
          { label: 'Unrealised gain', value: <Amount value={i.unrealisedGainMinor} currency={c} signed /> },
          { label: 'Income', value: <Amount value={i.incomeMinor} currency={c} /> },
          { label: 'Total return (all funded)', value: <ReturnFigure inv={i} currency={c} />, emphasis: true },
        ]}
      />
      <p className="mt-2 text-xs text-muted-foreground">
        {i.profitable} profitable · {i.closed} closed · {plural(i.maturingIn30Days, 'investment')} maturing in 30 days
      </p>
    </Panel>
  );
}

export function SavingsCard({ d }: { d: ChamaOverviewView }) {
  const s = d.savings!;
  const can = useCan();
  return (
    <Panel title="Savings" actions={can('MEMBER_ACCOUNTS_VIEW_ALL') && <PanelLink href="/member-accounts">Accounts</PanelLink>}>
      <p className="mb-3 text-xl font-semibold leading-tight"><Amount value={s.totalMinor} currency={d.currency} /></p>
      {s.products.length === 0
        ? <p className="text-sm text-muted-foreground">No savings products hold money yet.</p>
        : <BarList items={s.products.map((p) => ({ key: p.productId, label: p.name, value: p.balanceMinor, hint: p.code }))} currency={d.currency} />}
    </Panel>
  );
}

export function CashCard({ d }: { d: ChamaOverviewView }) {
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

/** This month and year to date side by side. A negative surplus is a deficit: red, with a minus sign and the word. */
export function PerformanceCard({ d }: { d: ChamaOverviewView }) {
  const c = d.currency;
  const cols: { title: string; p: PerformanceSection }[] = [{ title: 'This month', p: d.thisMonth }, { title: 'Year to date', p: d.yearToDate }];
  return (
    <Panel title="Performance" flush>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead />
            {cols.map((col) => <TableHead key={col.title} className="text-right" title={`${formatDate(col.p.from)} – ${formatDate(col.p.to)}`}>{col.title}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Income</TableCell>
            {cols.map((col) => <TableCell key={col.title} className="text-right"><Amount value={col.p.incomeMinor} currency={c} bare /></TableCell>)}
          </TableRow>
          <TableRow>
            <TableCell>Expenses</TableCell>
            {cols.map((col) => <TableCell key={col.title} className="text-right"><Amount value={col.p.expensesMinor} currency={c} bare /></TableCell>)}
          </TableRow>
          <TableRow className="border-t-2 font-semibold">
            <TableCell>Surplus / deficit</TableCell>
            {cols.map((col) => (
              <TableCell key={col.title} className="text-right">
                <Amount value={col.p.surplusMinor} currency={c} bare />
                <span className={cn('block text-2xs font-normal', col.p.surplusMinor < 0 ? 'text-destructive' : 'text-muted-foreground')}>{col.p.surplusMinor < 0 ? 'Deficit' : 'Surplus'}</span>
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </Panel>
  );
}
