'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Eye, EyeOff, FileText, Handshake, Landmark, ReceiptText, Send, Wallet } from 'lucide-react';
import { reportsApi } from '@/api/endpoints/books';
import type { MemberDashboardView, MemberStatementView } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { StatusChip } from '@/components/shared/Display';
import { Identifier } from '@/components/shared/Identifier';
import { Panel } from '@/components/shared/Panel';
import { Skeleton } from '@/components/ui/primitives';
import { useCan, useHasFeature } from '@/hooks/useSessionInfo';
import { addDays, formatDate, todayNairobi } from '@/lib/format';
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

/** Shortcuts, each gated as the screen it opens. */
export function QuickActions({ d }: { d: MemberDashboardView }) {
  const can = useCan();
  const hasFeature = useHasFeature();
  const actions = [
    d.loans && can('LOAN_APPLY') && { href: '/me/loans/apply', label: 'Apply for a loan', icon: <Landmark /> },
    hasFeature('REPORTS') && { href: '/me/statement', label: 'Statement', icon: <FileText /> },
    d.loans && { href: '/me/guarantees', label: 'Guarantee requests', icon: <Handshake />, count: d.loans.guaranteeRequests },
    d.contributions && { href: '/me/contributions', label: 'My contributions', icon: <Wallet /> },
    can('PAYMENT_SUBMIT') && { href: '/me/payments/new', label: 'Report a payment', icon: <Send /> },
    { href: '/me/payments', label: 'My reported payments', icon: <ReceiptText />, count: d.submissions.pending },
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
