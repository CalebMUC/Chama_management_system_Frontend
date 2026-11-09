'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarRange, CheckCircle2, ChevronRight, Eye, EyeOff, FileText, HandCoins,
  Handshake, Landmark, Wallet,
} from 'lucide-react';
import { reportsApi } from '@/api/endpoints/books';
import type { MemberDashboardView, MemberStatementView } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { StatusChip } from '@/components/shared/Display';
import { Identifier } from '@/components/shared/Identifier';
import { Panel } from '@/components/shared/Panel';
import { Skeleton } from '@/components/ui/primitives';
import { useCan, useHasFeature } from '@/hooks/useSessionInfo';
import { addDays, dueIn, formatDate, formatInstant, formatPeriodKey, todayNairobi, daysBetween } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { usePreferences } from '@/stores/preferences';

/** Show / hide balances on My banking screens (the hideBalances preference). */
export function BalancesToggle({ className, onHero }: { className?: string; onHero?: boolean }) {
  const hidden = usePreferences((s) => s.hideBalances);
  const set = usePreferences((s) => s.set);
  const Icon = hidden ? Eye : EyeOff;
  return (
    <button
      type="button"
      onClick={() => set('hideBalances', !hidden)}
      aria-pressed={hidden}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        onHero ? 'border-white/25 text-[hsl(var(--hero-foreground))] hover:bg-white/10' : 'bg-card hover:bg-accent',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {hidden ? 'Show balances' : 'Hide balances'}
    </button>
  );
}

/** Total savings, loan balance and net position (savings less loans outstanding), as at the dashboard's time. */
export function BalanceHero({ d }: { d: MemberDashboardView }) {
  const savings = d.savings?.totalMinor ?? null;
  const loans = d.loans?.outstandingMinor ?? null;
  const net = savings !== null ? savings - (loans ?? 0) : null;
  return (
    <section aria-label="Balances" className="hero overflow-hidden rounded-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Balances · as at {formatInstant(d.generatedAt)}</p>
        <BalancesToggle onHero />
      </div>
      <div className="grid gap-4 px-4 py-4 sm:grid-cols-[1.4fr_1fr_1fr] sm:gap-6">
        {savings !== null && (
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Total savings</p>
            <p className="mt-0.5 text-[1.75rem] font-semibold leading-tight tracking-tight"><Amount value={savings} currency={d.currency} /></p>
            <p className="mt-0.5 text-xs text-muted-foreground">{d.savings!.accounts.filter((a) => a.active).length} active account{d.savings!.accounts.filter((a) => a.active).length === 1 ? '' : 's'}</p>
          </div>
        )}
        {loans !== null && (
          <div className="min-w-0 sm:border-l sm:border-white/10 sm:pl-6">
            <p className="text-xs text-muted-foreground">Loan balance</p>
            <p className="mt-0.5 text-xl font-semibold leading-tight"><Amount value={loans} currency={d.currency} /></p>
            <p className="mt-0.5 text-xs text-muted-foreground">{d.loans!.activeLoans} active loan{d.loans!.activeLoans === 1 ? '' : 's'}</p>
          </div>
        )}
        {net !== null && (
          <div className="min-w-0 sm:border-l sm:border-white/10 sm:pl-6">
            <p className="text-xs text-muted-foreground">Net position</p>
            <p className="mt-0.5 text-xl font-semibold leading-tight"><Amount value={net} currency={d.currency} /></p>
            <p className="mt-0.5 text-xs text-muted-foreground">Savings less loans outstanding</p>
          </div>
        )}
      </div>
    </section>
  );
}

/** One tile per savings account: product, masked account number, balance, statement. */
export function AccountTiles({ d }: { d: MemberDashboardView }) {
  if (!d.savings) return null;
  const accounts = d.savings.accounts;
  return (
    <Panel
      title="My accounts"
      actions={<Link href="/me/savings" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">All accounts<ArrowRight className="size-3.5" aria-hidden /></Link>}
    >
      {accounts.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No savings accounts yet. Your officials open them for you.</p>
      ) : (
        <ul className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(15rem, 100%), 1fr))' }}>
          {accounts.map((a) => (
            <li key={a.accountId} className={cn('flex flex-col rounded-md border p-3', !a.active && 'bg-muted/40')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{a.productName}</p>
                  <p className="text-xs text-muted-foreground"><Identifier value={a.accountNumber} label="account number" masked /></p>
                </div>
                {!a.active && <StatusChip status="CLOSED" />}
              </div>
              <p className="mt-3 text-lg font-semibold leading-tight"><Amount value={a.balanceMinor} currency={d.currency} /></p>
              <Link href={`/me/savings/${a.accountId}`} className="mt-2 inline-flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline">
                <FileText className="size-3.5" aria-hidden />Statement
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Obligation({ icon, title, detail, value, alert, href }: { icon: ReactNode; title: ReactNode; detail?: ReactNode; value: ReactNode; alert?: boolean; href?: string }) {
  const body = (
    <>
      <span className={cn('mt-0.5 shrink-0 [&_svg]:size-4', alert ? 'text-destructive' : 'text-muted-foreground')} aria-hidden>{alert ? <AlertTriangle /> : icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {detail && <span className={cn('block text-xs', alert ? 'text-destructive' : 'text-muted-foreground')}>{detail}</span>}
      </span>
      <span className="shrink-0 text-right text-sm font-semibold">{value}</span>
      {href && <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );
  const cls = cn('flex items-start gap-2.5 px-[var(--panel-p)] py-2.5', alert && 'bg-destructive/[0.06]');
  return <li>{href ? <Link href={href} className={cn(cls, 'hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none')}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
}

/** What the member owes and when: next instalment, this period's contribution, arrears and penalties (highlighted when not zero). */
export function Obligations({ d }: { d: MemberDashboardView }) {
  const today = todayNairobi();
  const c = d.currency;
  const rows: ReactNode[] = [];
  if (d.loans) {
    const due = d.loans.nextDueDate;
    rows.push(
      <Obligation
        key="instalment"
        icon={<HandCoins />}
        title="Next loan instalment"
        detail={due ? <>{formatDate(due)} · {dueIn(due, today)}</> : 'Nothing due'}
        value={due ? <Amount value={d.loans.nextDueMinor} currency={c} /> : '—'}
        alert={!!due && daysBetween(today, due) < 0}
        href="/me/loans"
      />,
    );
  }
  if (d.contributions) {
    rows.push(
      <Obligation
        key="period"
        icon={<CalendarRange />}
        title={`Contribution · ${formatPeriodKey(d.contributions.currentPeriod)}`}
        detail={d.contributions.latePeriods > 0 ? `${d.contributions.latePeriods} late period${d.contributions.latePeriods === 1 ? '' : 's'} so far` : 'No late periods'}
        value={d.contributions.currentPeriodStatus ? <StatusChip status={d.contributions.currentPeriodStatus} /> : '—'}
        href="/me/contributions"
      />,
    );
    const arrears = d.contributions.arrearsMinor;
    rows.push(
      <Obligation key="c-arrears" icon={<CheckCircle2 />} title="Contribution arrears" detail={arrears > 0 ? 'Pay to an official to clear' : 'Up to date'} value={<Amount value={arrears} currency={c} />} alert={arrears > 0} />,
    );
  }
  if (d.loans) {
    const arrears = d.loans.arrearsMinor;
    rows.push(<Obligation key="l-arrears" icon={<CheckCircle2 />} title="Loan arrears" detail={arrears > 0 ? 'Instalments past due' : 'Up to date'} value={<Amount value={arrears} currency={c} />} alert={arrears > 0} />);
  }
  if (d.penaltiesOutstandingMinor !== null) {
    const owed = d.penaltiesOutstandingMinor;
    rows.push(
      <Obligation key="penalties" icon={<CheckCircle2 />} title="Penalties outstanding" detail={owed > 0 ? 'Pay to an official, who records it' : 'None'} value={<Amount value={owed} currency={c} />} alert={owed > 0} href="/me/penalties" />,
    );
  }
  if (rows.length === 0) return null;
  return (
    <Panel title="What you owe" flush>
      <ul className="divide-y">{rows}</ul>
    </Panel>
  );
}

/** Shortcuts, each gated as the screen it opens. */
export function QuickActions({ d }: { d: MemberDashboardView }) {
  const can = useCan();
  const hasFeature = useHasFeature();
  const actions = [
    d.loans && can('LOAN_APPLY') && { href: '/me/loans/apply', label: 'Apply for a loan', icon: <Landmark /> },
    hasFeature('REPORTS') && { href: '/me/statement', label: 'Statement', icon: <FileText /> },
    d.loans && { href: '/me/guarantees', label: 'Guarantee requests', icon: <Handshake />, count: d.loans.guaranteeRequests },
    d.contributions && { href: '/me/contributions', label: 'My contributions', icon: <Wallet /> },
  ].filter(Boolean) as { href: string; label: string; icon: ReactNode; count?: number }[];
  if (actions.length === 0) return null;
  return (
    <Panel title="Quick actions">
      <ul className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <li key={a.href}>
            <Link href={a.href} className="relative flex h-full flex-col items-start gap-2 rounded-md border p-2.5 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary [&_svg]:size-4" aria-hidden>{a.icon}</span>
              <span className="leading-tight">{a.label}</span>
              {!!a.count && (
                <span className="absolute right-2 top-2 rounded-sm bg-gold px-1.5 text-[10px] font-semibold leading-4 text-sidebar tabular" aria-label={`${a.count} waiting`}>{a.count}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

interface MiniLine {
  key: string;
  date: string;
  description: string;
  reference: string | null;
  account: string;
  /** From the member's side: positive = money into their savings, negative = owed or out. */
  amountMinor: number;
}

/** Statement lines from the last 30 days across savings and penalties, newest first. */
export function miniStatementLines(s: MemberStatementView, limit = 8): MiniLine[] {
  const lines: MiniLine[] = [];
  for (const a of s.savings) {
    a.lines.forEach((l, i) => lines.push({ key: `${a.code}-${l.entryNumber}-${i}`, date: l.date, description: l.description, reference: l.reference, account: a.name, amountMinor: l.creditMinor - l.debitMinor }));
  }
  s.penalties?.lines.forEach((l, i) =>
    lines.push({ key: `pen-${l.entryNumber}-${i}`, date: l.date, description: l.description, reference: l.reference, account: 'Penalties', amountMinor: -(l.debitMinor - l.creditMinor) }),
  );
  return lines.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, limit);
}

/** Recent transactions (README §7.13 statement, last 30 days). Needs the REPORTS feature. */
export function MiniStatement({ currency }: { currency: string }) {
  const to = todayNairobi();
  const range = { from: addDays(to, -30), to };
  const q = useQuery({ queryKey: ['reports', 'memberStatement', 'me', range], queryFn: () => reportsApi.myStatement(range) });
  const lines = q.data ? miniStatementLines(q.data) : [];
  return (
    <Panel
      title="Recent transactions · last 30 days"
      flush
      actions={<Link href="/me/statement" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Full statement<ArrowRight className="size-3.5" aria-hidden /></Link>}
    >
      {q.isLoading ? (
        <div className="space-y-2 p-[var(--panel-p)]">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : q.error ? (
        <p className="p-[var(--panel-p)] text-sm text-muted-foreground">Couldn&apos;t load recent transactions. <button type="button" className="font-medium text-primary hover:underline" onClick={() => q.refetch()}>Retry</button></p>
      ) : lines.length === 0 ? (
        <p className="p-[var(--panel-p)] text-sm text-muted-foreground">No transactions in the last 30 days.</p>
      ) : (
        <ul className="divide-y">
          {lines.map((l) => {
            const credit = l.amountMinor >= 0;
            const Icon = credit ? ArrowDownLeft : ArrowUpRight;
            return (
              <li key={l.key} className="flex items-center gap-3 px-[var(--panel-p)] py-2">
                <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full', credit ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')} aria-hidden>
                  <Icon className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{l.description}</span>
                  <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                    <span>{formatDate(l.date)}</span>
                    <span aria-hidden>·</span>
                    <span>{l.account}</span>
                    {l.reference && <><span aria-hidden>·</span><Identifier value={l.reference} label={`${label('MPESA')} or bank reference`} /></>}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm font-medium">
                  <Amount value={l.amountMinor} currency={currency} signed />
                  <span className="sr-only">{credit ? ' in' : ' out'}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
