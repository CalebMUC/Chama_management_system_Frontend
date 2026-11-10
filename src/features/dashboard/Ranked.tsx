'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Medal } from 'lucide-react';
import type { LicenseFeature, RankedInvestment, TopMember } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { Progress, StatusChip } from '@/components/shared/Display';
import { LoadingState } from '@/components/shared/States';
import { useCan, useHasFeature, type Requirement } from '@/hooks/useSessionInfo';
import { formatBp } from '@/lib/format';
import { label } from '@/lib/labels';
import { cn } from '@/lib/utils';

// Shared pieces of the dashboards (DASHBOARDS.md): rankings, return and compliance figures, and the drill-down guard.

/** Where "See all" on the rankings leads. Top investments sits under Investments so plain members (INVESTMENT_VIEW) can reach it. */
export const DASHBOARD_ROUTES = {
  overview: '/chama',
  topMembers: '/chama/top-members',
  topInvestments: '/investments/top',
  trends: '/chama/trends',
} as const;

export const seeAllLink = 'inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline';

/**
 * A drill-down screen's gate. A missing permission (ACCESS_DENIED) goes to the member home, and a feature the licence lacks
 * (LICENSE_FEATURE_NOT_INCLUDED) goes back to `featureFallback`, instead of showing an error.
 */
export function RedirectGuard({ permission, feature, featureFallback = '/home', children }: {
  permission: Requirement;
  feature?: LicenseFeature;
  featureFallback?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const can = useCan();
  const hasFeature = useHasFeature();
  const target = !can(permission) ? '/home' : feature && !hasFeature(feature) ? featureFallback : null;
  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);
  if (target) return <LoadingState label="Redirecting…" />;
  return <>{children}</>;
}

/** 1, 2, 3 get a medal chip (gold, silver, bronze); the rest a plain number. The rank is always in the text. */
export function RankBadge({ rank }: { rank: number }) {
  if (rank > 3) return <span className="inline-block min-w-6 text-center text-sm tabular text-muted-foreground">{rank}</span>;
  const tone = ['bg-gold/30 text-foreground', 'bg-muted text-foreground', 'bg-warning/20 text-foreground'][rank - 1];
  return (
    <span className={cn('inline-flex h-5 min-w-6 items-center justify-center gap-0.5 rounded-sm px-1 text-xs font-semibold tabular', tone)} aria-label={`Rank ${rank}`}>
      <Medal className="size-3" aria-hidden />{rank}
    </span>
  );
}

/** A rate in basis points as a signed percentage: green above zero, red below, neutral at zero. */
export function SignedRate({ bp, className }: { bp: number | null | undefined; className?: string }) {
  if (bp === null || bp === undefined) return <span className={cn('text-muted-foreground', className)}>—</span>;
  const sign = bp > 0 ? '+' : bp < 0 ? '−' : '';
  return <span className={cn('tabular whitespace-nowrap', bp > 0 && 'text-success', bp < 0 && 'text-destructive', className)}>{sign}{formatBp(Math.abs(bp))}</span>;
}

/** An investment's return as money and %: green when profitable, red when negative, neutral at 0. */
export function ReturnFigure({ inv, currency, stacked }: { inv: Pick<RankedInvestment, 'totalReturnMinor' | 'returnBasisPoints'>; currency: string; stacked?: boolean }) {
  return (
    <span className={cn('inline-flex items-baseline gap-x-1.5', stacked && 'flex-col items-end gap-0')}>
      <Amount value={inv.totalReturnMinor} currency={currency} signed sensitive={false} />
      <SignedRate bp={inv.returnBasisPoints} className="text-xs" />
    </span>
  );
}

/** Compliance: green ≥ 90%, amber 70–89%, red < 70%. Words go with the colour. */
export function complianceTone(bp: number): 'success' | 'warning' | 'destructive' {
  return bp >= 9000 ? 'success' : bp >= 7000 ? 'warning' : 'destructive';
}

export function ComplianceBar({ bp, className }: { bp: number; className?: string }) {
  const tone = complianceTone(bp);
  return (
    <span className={cn('flex min-w-[7rem] items-center gap-2', className)}>
      <Progress value={bp} max={10_000} tone={tone} label="Compliance" className="flex-1" />
      <span className={cn('w-12 text-right text-xs font-medium tabular', tone === 'destructive' && 'text-destructive', tone === 'warning' && 'text-warning-text')}>{formatBp(bp)}</span>
    </span>
  );
}

/** The overview's compact top-members list (up to 5). */
export function TopMembersList({ members, currency }: { members: TopMember[]; currency: string }) {
  if (members.length === 0) return <p className="px-[var(--panel-p)] py-6 text-center text-sm text-muted-foreground">No contributions this year yet.</p>;
  return (
    <ol className="divide-y">
      {members.map((m) => (
        <li key={m.memberUserId} className="flex items-center gap-2.5 px-[var(--panel-p)] py-2 text-sm">
          <RankBadge rank={m.rank} />
          <span className="min-w-0 flex-1">
            <Link href={`/members/${m.memberUserId}`} className="block truncate font-medium hover:underline">{m.name}</Link>
            <span className="text-xs text-muted-foreground">
              {m.memberNumber ? `#${m.memberNumber} · ` : ''}{m.payments} payment{m.payments === 1 ? '' : 's'} · {formatBp(m.complianceRateBasisPoints)} compliance
            </span>
          </span>
          <Amount value={m.contributedMinor} currency={currency} sensitive={false} className="shrink-0 font-medium" />
        </li>
      ))}
    </ol>
  );
}

/** The compact top-investments list: the overview (up to 5) and the member home (up to 3). */
export function TopInvestmentsList({ investments, currency, linkRows = true, emptyAction }: { investments: RankedInvestment[]; currency: string; linkRows?: boolean; emptyAction?: ReactNode }) {
  if (investments.length === 0) {
    return (
      <div className="px-[var(--panel-p)] py-6 text-center text-sm text-muted-foreground">
        <p>No funded investments yet.</p>
        {emptyAction && <div className="mt-2">{emptyAction}</div>}
      </div>
    );
  }
  return (
    <ol className="divide-y">
      {investments.map((i) => (
        <li key={i.investmentId} className="flex items-center gap-2.5 px-[var(--panel-p)] py-2 text-sm">
          <RankBadge rank={i.rank} />
          <span className="min-w-0 flex-1">
            {linkRows ? <Link href={`/investments/${i.investmentId}`} className="block truncate font-medium hover:underline">{i.name}</Link> : <span className="block truncate font-medium">{i.name}</span>}
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {label(i.type)}
              {i.status === 'CLOSED' && <StatusChip status="CLOSED" />}
            </span>
          </span>
          <ReturnFigure inv={i} currency={currency} stacked />
        </li>
      ))}
    </ol>
  );
}

/** A small single-choice button group ("Show 10 / 25 / 50", "6 / 12 / 24 months"). */
export function Segmented<T extends string | number>({ value, options, onChange, label: name }: { value: T; options: { value: T; label: string }[]; onChange(v: T): void; label: string }) {
  return (
    <div role="group" aria-label={name} className="inline-flex rounded-md border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-7 rounded-[5px] px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            o.value === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
