'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CalendarRange, Clock, Handshake, Send, Trophy } from 'lucide-react';
import type { MemberDashboardView } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { Progress, StatusChip } from '@/components/shared/Display';
import { KeyValue, Panel } from '@/components/shared/Panel';
import { DASHBOARD_ROUTES, TopInvestmentsList } from '@/features/dashboard/Ranked';
import { MY_REPORTS_PATH, reportPaymentHref } from '@/features/submissions/submissionLinks';
import { useCan } from '@/hooks/useSessionInfo';
import { daysBetween, dueIn, formatBp, formatDate, formatInstant, formatPeriodKey, plural, todayNairobi } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { BalancesToggle } from './MemberHome';

// The member home's cards (DASHBOARDS.md "Member home"): one per licensed section of GET /dashboard/me. Each returns null when
// its section is null.

const CardLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">{children}<ArrowRight className="size-3.5" aria-hidden /></Link>
);

/** Red when above zero (arrears, amounts owed). */
const Owed = ({ value, currency }: { value: number; currency: string }) => <Amount value={value} currency={currency} className={value > 0 ? 'text-destructive' : undefined} />;

/**
 * The lead figure: net position (savings less loans and penalties owed, from the server), green when positive and red when
 * negative, with its breakdown. Terms whose section is null (unlicensed) are left out.
 */
export function NetPositionHero({ d }: { d: MemberDashboardView }) {
  const net = d.netPositionMinor;
  const terms = [
    d.savings && { key: 'savings', text: 'Savings', value: d.savings.totalMinor },
    d.loans && { key: 'loans', text: 'loans', value: d.loans.outstandingMinor },
    d.penalties && { key: 'penalties', text: 'penalties', value: d.penalties.outstandingMinor },
  ].filter(Boolean) as { key: string; text: string; value: number }[];
  return (
    <section aria-label="Net position" className="hero overflow-hidden rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Balances · as at {formatInstant(d.generatedAt)}</p>
        <BalancesToggle onHero />
      </div>
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-[1.4fr_1fr_1fr] sm:gap-6">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Net position</p>
          <p className={cn('mt-0.5 text-[1.75rem] font-semibold leading-tight tracking-tight', net > 0 && 'text-success')}><Amount value={net} currency={d.currency} /></p>
          {terms.length > 1 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {terms.map((t, i) => (
                <span key={t.key} className="whitespace-nowrap">{i > 0 && ' − '}{t.text} <Amount value={t.value} currency={d.currency} /></span>
              ))}
            </p>
          )}
        </div>
        {d.savings && (
          <div className="min-w-0 sm:border-l sm:border-white/10 sm:pl-6">
            <p className="text-xs text-muted-foreground">Total savings</p>
            <p className="mt-0.5 text-xl font-semibold leading-tight"><Amount value={d.savings.totalMinor} currency={d.currency} /></p>
            <p className="mt-0.5 text-xs text-muted-foreground">{plural(d.savings.accounts.filter((a) => a.active).length, 'active account')}</p>
          </div>
        )}
        {d.loans && (
          <div className="min-w-0 sm:border-l sm:border-white/10 sm:pl-6">
            <p className="text-xs text-muted-foreground">Loan balance</p>
            <p className="mt-0.5 text-xl font-semibold leading-tight"><Amount value={d.loans.outstandingMinor} currency={d.currency} /></p>
            <p className="mt-0.5 text-xs text-muted-foreground">{plural(d.loans.activeLoans, 'active loan')}</p>
          </div>
        )}
      </div>
    </section>
  );
}

/** This period's status, arrears, advance, this year's total, compliance and rank. */
export function MyContributionsCard({ d }: { d: MemberDashboardView }) {
  const k = d.contributions;
  if (!k) return null;
  const c = d.currency;
  return (
    <Panel title="Contributions" actions={<CardLink href="/me/contributions">View contributions</CardLink>}>
      {k.currentPeriod && k.currentPeriodStatus && (
        <div className={cn('mb-2 flex items-center justify-between gap-2 rounded-md border px-2.5 py-2', k.currentPeriodStatus === 'UNPAID' && 'border-destructive/40 bg-destructive/[0.06]')}>
          <span className="flex items-center gap-1.5 text-sm"><CalendarRange className="size-4 text-muted-foreground" aria-hidden />{formatPeriodKey(k.currentPeriod)}</span>
          <StatusChip status={k.currentPeriodStatus} />
        </div>
      )}
      <KeyValue
        items={[
          { label: 'Arrears', value: <Owed value={k.arrearsMinor} currency={c} /> },
          k.advanceMinor > 0 && { label: 'Paid in advance', value: <Amount value={k.advanceMinor} currency={c} /> },
          { label: 'Late periods', value: <span className={k.latePeriods > 0 ? 'text-destructive' : undefined}>{k.latePeriods}</span> },
          { label: 'Paid this year', value: <Amount value={k.contributedYearToDateMinor} currency={c} /> },
          { label: 'Compliance', value: formatBp(k.complianceRateBasisPoints) },
        ]}
      />
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Trophy className="size-3.5" aria-hidden />
        {k.rank === null ? 'Not ranked yet this year' : <span>Ranked <span className="font-semibold text-foreground">{k.rank}</span> of {k.rankOutOf} this year</span>}
      </p>
    </Panel>
  );
}

/** Totals, the next instalment and one row per loan with its repayment progress. */
export function MyLoansCard({ d }: { d: MemberDashboardView }) {
  const can = useCan();
  const canReport = can('PAYMENT_SUBMIT');
  const l = d.loans;
  if (!l) return null;
  const c = d.currency;
  const today = todayNairobi();
  const overdue = !!l.nextDueDate && daysBetween(today, l.nextDueDate) < 0;
  return (
    <Panel
      title="Loans"
      flush
      actions={
        <>
          {l.guaranteeRequests > 0 && (
            <Link href="/me/guarantees" className="inline-flex h-5 items-center gap-1 rounded-sm bg-gold px-1.5 text-2xs font-semibold text-sidebar hover:opacity-90">
              <Handshake className="size-3" aria-hidden />Respond · {l.guaranteeRequests}
            </Link>
          )}
          {can('LOAN_APPLY') && <CardLink href="/me/loans/apply">Apply for a loan</CardLink>}
        </>
      }
    >
      <div className="px-[var(--panel-p)] pt-1">
        <KeyValue
          items={[
            { label: 'Outstanding', value: <Amount value={l.outstandingMinor} currency={c} /> },
            { label: 'Arrears', value: <Owed value={l.arrearsMinor} currency={c} /> },
            {
              label: l.nextDueDate
                ? <>Next instalment · {formatDate(l.nextDueDate)} <span className={cn(overdue && 'text-destructive')}>({dueIn(l.nextDueDate, today)})</span></>
                : 'Next instalment',
              value: l.nextDueDate ? <Amount value={l.nextDueMinor} currency={c} className={overdue ? 'text-destructive' : undefined} /> : 'Nothing due',
            },
            { label: 'Borrowed / repaid', value: <><Amount value={l.totalBorrowedMinor} currency={c} /> <span className="text-muted-foreground">/</span> <Amount value={l.totalRepaidMinor} currency={c} /></> },
          ]}
        />
        {l.inProgress > 0 && <p className="border-t py-1.5 text-xs text-muted-foreground">{plural(l.inProgress, 'application')} being processed.</p>}
      </div>
      {l.loans.length === 0 ? (
        <p className="border-t px-[var(--panel-p)] py-4 text-center text-sm text-muted-foreground">No loans yet.</p>
      ) : (
        <ul className="divide-y border-t">
          {l.loans.map((loan) => (
            <li key={loan.loanId} className="px-[var(--panel-p)] py-2.5">
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <Link href="/me/loans" className="truncate text-sm font-medium hover:underline">{loan.productName}</Link>
                  <StatusChip status={loan.status} />
                </span>
                {loan.disbursedOn && <Amount value={loan.outstandingMinor} currency={c} className="shrink-0 text-sm font-semibold" />}
              </span>
              {loan.disbursedOn ? (
                <span className="mt-1.5 flex items-center gap-2">
                  <Progress value={loan.repaidBasisPoints} max={10_000} tone={loan.daysInArrears > 0 ? 'destructive' : 'success'} label={`${loan.productName} repaid`} className="flex-1" />
                  <span className="w-20 text-right text-xs text-muted-foreground tabular">{formatBp(loan.repaidBasisPoints)} repaid</span>
                </span>
              ) : (
                // Not paid out yet (an application in progress): nothing is owed, so show what was asked for.
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Applied for <Amount value={loan.principalMinor} currency={c} />{loan.appliedOn ? ` on ${formatDate(loan.appliedOn)}` : ''}
                </span>
              )}
              {loan.daysInArrears > 0 && (
                <span className="mt-1 flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="size-3" aria-hidden />{plural(loan.daysInArrears, 'day')} in arrears · <Amount value={loan.arrearsMinor} currency={c} />
                </span>
              )}
              {canReport && loan.status === 'ACTIVE' && loan.outstandingMinor > 0 && (
                <Link href={reportPaymentHref({ kind: 'LOAN_REPAYMENT', targetId: loan.loanId })} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  <Send className="size-3" aria-hidden />Report a repayment I made
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** What the member owes in penalties now, item by item (oldest first), and what they paid or had waived to date. */
export function MyPenaltiesCard({ d }: { d: MemberDashboardView }) {
  const canReport = useCan()('PAYMENT_SUBMIT');
  const p = d.penalties;
  if (!p) return null;
  const c = d.currency;
  return (
    <Panel title="Penalties" flush actions={<CardLink href="/me/penalties">My penalties</CardLink>}>
      <div className="px-[var(--panel-p)] py-2">
        <p className="text-lg font-semibold leading-tight"><Owed value={p.outstandingMinor} currency={c} /></p>
        <p className="text-xs text-muted-foreground">
          Owed now · {plural(p.outstandingCount, 'penalty', 'penalties')} · paid <Amount value={p.paidMinor} currency={c} /> · waived <Amount value={p.waivedMinor} currency={c} />
        </p>
      </div>
      {p.outstanding.length > 0 && (
        <ul className="divide-y border-t">
          {p.outstanding.map((x) => (
            <li key={x.penaltyId} className="flex items-start justify-between gap-2 px-[var(--panel-p)] py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{x.description}</span>
                <span className="text-xs text-muted-foreground">
                  {label(x.kind)} · {formatDate(x.assessedOn)}
                  {x.outstandingMinor !== x.amountMinor && <> · of <Amount value={x.amountMinor} currency={c} /></>}
                </span>
                {canReport && (
                  <Link href={reportPaymentHref({ kind: 'PENALTY_PAYMENT', targetId: x.penaltyId })} className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <Send className="size-3" aria-hidden />I&apos;ve paid this
                  </Link>
                )}
              </span>
              <Amount value={x.outstandingMinor} currency={c} className="shrink-0 font-medium text-destructive" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Payments the member reported that wait for an official to confirm. Shown only when there are some. */
export function PendingReports({ d }: { d: MemberDashboardView }) {
  if (d.submissions.pending <= 0) return null;
  return (
    <Link href={MY_REPORTS_PATH} className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm hover:bg-warning/15" role="status">
      <Clock className="size-4 shrink-0 text-warning-text" aria-hidden />
      <span className="flex-1">{plural(d.submissions.pending, 'payment')} you reported {d.submissions.pending === 1 ? 'is' : 'are'} awaiting confirmation by the treasurer.</span>
      <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
    </Link>
  );
}

/** "Our investments": up to 3 by return. Null when the licence lacks INVESTMENTS or the member lacks INVESTMENT_VIEW. */
export function OurInvestments({ d }: { d: MemberDashboardView }) {
  if (!d.topInvestments) return null;
  return (
    <Panel title="Our investments" flush actions={<CardLink href={DASHBOARD_ROUTES.topInvestments}>See all</CardLink>}>
      <TopInvestmentsList investments={d.topInvestments} currency={d.currency} />
    </Panel>
  );
}
