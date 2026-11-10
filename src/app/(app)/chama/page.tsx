'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Briefcase, Gavel, HandCoins, Landmark, PiggyBank, RefreshCw, Scale, Wallet } from 'lucide-react';
import { dashboardApi, dashboardKeys } from '@/api/endpoints/books';
import type { ChamaDashboardView, ChamaOverviewView, LicenseFeature } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { EntryLink, PageHeader, StatCard } from '@/components/shared/Display';
import { Identifier } from '@/components/shared/Identifier';
import { KpiStrip } from '@/components/shared/Kpi';
import { Panel } from '@/components/shared/Panel';
import { ErrorState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Badge, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import {
  CashCard, ContributionsCard, InvestmentsCard, LoansCard, MembersCard, NeedsAttention, par30Tone, PenaltiesCard, PerformanceCard,
  SavingsCard,
} from '@/features/dashboard/OverviewCards';
import { DASHBOARD_ROUTES, RedirectGuard, seeAllLink, SignedRate, TopInvestmentsList, TopMembersList } from '@/features/dashboard/Ranked';
import { TrendChart } from '@/features/dashboard/TrendChart';
import { useCan } from '@/hooks/useSessionInfo';
import { formatBp, formatDate, formatTime, plural } from '@/lib/format';
import { label } from '@/lib/labels';

export default function ChamaOverviewPage() {
  return (
    <RedirectGuard permission="CHAMA_VIEW">
      <Overview />
    </RedirectGuard>
  );
}

/** Work-queue counts are the only figures worth polling (DASHBOARDS.md "Refresh"); React Query pauses it in background tabs. */
const POLL = 3 * 60_000;

const SeeAll = ({ href, text = 'See all' }: { href: string; text?: string }) => (
  <Link href={href} className={seeAllLink}>{text}<ArrowRight className="size-3.5" aria-hidden /></Link>
);

/** The officials' view carries the work queue, rankings and ledger detail; the members' view leaves them out. */
const isOfficialView = (d: ChamaDashboardView | ChamaOverviewView): d is ChamaDashboardView => 'pending' in d;

/**
 * DASHBOARDS.md "Chama overview" and "for members": with REPORT_VIEW_ALL, GET /dashboard (KPI row, needs attention, section
 * cards, rankings, trend, recent entries); otherwise GET /dashboard/overview, the same chama-wide cards without anything that
 * names a member or is an official's work.
 */
function Overview() {
  const can = useCan();
  const full = can('REPORT_VIEW_ALL');
  const q = useQuery<ChamaDashboardView | ChamaOverviewView>({
    queryKey: full ? dashboardKeys.chama : dashboardKeys.overview,
    queryFn: full ? dashboardApi.chama : dashboardApi.overview,
    refetchOnWindowFocus: true,
    // Only the officials' view has work-queue counts worth polling.
    refetchInterval: full ? POLL : false,
  });
  if (q.error && !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-72" />
        <KpiStrip>{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</KpiStrip>
        <div className="grid gap-3 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      </div>
    );
  }
  const d = q.data;
  const c = d.currency;
  const k = d.keyFigures;
  const has = (f: LicenseFeature) => d.features.includes(f);
  const official = isOfficialView(d) ? d : null;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Chama overview"
        description={<>{d.chamaName} · As of {formatDate(d.asOf)} · generated {formatTime(d.generatedAt)}</>}
        actions={<Button variant="outline" size="sm" onClick={() => q.refetch()} loading={q.isFetching}><RefreshCw />Refresh</Button>}
      />

      <KpiStrip min={190}>
        {k.totalContributionsMinor !== null && (
          <StatCard
            label="Total contributions"
            value={<Amount value={k.totalContributionsMinor} currency={c} />}
            hint={<><Amount value={k.contributionsYearToDateMinor} currency={c} /> this year</>}
            icon={<Wallet />}
            href={can('CONTRIBUTION_VIEW_ALL') ? '/contributions' : undefined}
          />
        )}
        {k.totalSavingsMinor !== null && (
          <StatCard
            label="Savings"
            value={<Amount value={k.totalSavingsMinor} currency={c} />}
            hint={plural(d.savings?.products.length ?? 0, 'product')}
            icon={<PiggyBank />}
            tone="success"
            href={can('MEMBER_ACCOUNTS_VIEW_ALL') ? '/member-accounts' : undefined}
          />
        )}
        <StatCard
          label="Cash"
          value={<Amount value={k.cashMinor} currency={c} />}
          hint={<>Cash <Amount value={d.cash.cashOnHandMinor} currency={c} bare /> · Bank <Amount value={d.cash.bankMinor} currency={c} bare /> · M-Pesa <Amount value={d.cash.mobileMoneyMinor} currency={c} bare /></>}
          icon={<Landmark />}
        />
        {k.loansOutstandingMinor !== null && (
          <StatCard
            label="Loans outstanding"
            value={<Amount value={k.loansOutstandingMinor} currency={c} />}
            hint={d.loans ? `PAR30 ${formatBp(d.loans.par30BasisPoints)}` : undefined}
            icon={<HandCoins />}
            tone={d.loans ? par30Tone(d.loans.par30BasisPoints) : 'default'}
            href={can('LOAN_VIEW_ALL') ? '/loans' : undefined}
          />
        )}
        {k.investmentsMarketValueMinor !== null && (
          <StatCard
            label="Investments"
            value={<Amount value={k.investmentsMarketValueMinor} currency={c} />}
            hint={d.investments ? <>Return <SignedRate bp={d.investments.returnBasisPoints} /></> : undefined}
            icon={<Briefcase />}
            href={can('INVESTMENT_VIEW') ? '/investments/portfolio' : undefined}
          />
        )}
        {k.penaltiesOutstandingMinor !== null && (
          <StatCard
            label="Penalties owed"
            value={<Amount value={k.penaltiesOutstandingMinor} currency={c} />}
            hint={d.penalties ? plural(d.penalties.membersOwing, 'member') : undefined}
            icon={<Gavel />}
            tone={k.penaltiesOutstandingMinor > 0 ? 'warning' : 'default'}
            href={can('PENALTY_VIEW_ALL') ? '/penalties' : undefined}
          />
        )}
        <StatCard
          label="Net worth"
          value={<Amount value={k.netWorthMinor} currency={c} />}
          hint={<>Assets <Amount value={k.totalAssetsMinor} currency={c} /></>}
          icon={<Scale />}
          tone={k.netWorthMinor < 0 ? 'destructive' : 'gold'}
        />
      </KpiStrip>

      <div className="grid items-start gap-3 lg:grid-cols-3">
        {official && <NeedsAttention d={official} />}
        <MembersCard d={d} />
        {d.contributions && <ContributionsCard d={d} />}
        {d.loans && <LoansCard d={d} />}
        {d.penalties && <PenaltiesCard d={d} />}
        {d.investments && <InvestmentsCard d={d} />}
        {d.savings && <SavingsCard d={d} />}
        <CashCard d={d} />
        <PerformanceCard d={d} />
      </div>

      {(official?.topMembers || d.topInvestments) && (
        <div className="grid items-start gap-3 lg:grid-cols-2">
          {official?.topMembers && (
            <Panel title="Top members this year" flush actions={has('CONTRIBUTIONS') && <SeeAll href={DASHBOARD_ROUTES.topMembers} />}>
              <TopMembersList members={official.topMembers} currency={c} />
            </Panel>
          )}
          {d.topInvestments && (
            <Panel title="Top investments by return" flush actions={can('INVESTMENT_VIEW') && has('INVESTMENTS') && <SeeAll href={DASHBOARD_ROUTES.topInvestments} />}>
              <TopInvestmentsList investments={d.topInvestments} currency={c} linkRows={can('INVESTMENT_VIEW')} />
            </Panel>
          )}
        </div>
      )}

      {/* The 6-24 month view needs REPORT_VIEW_ALL; members see the six months in this view only. */}
      <Panel title="Trend · last 6 months" actions={full && <SeeAll href={DASHBOARD_ROUTES.trends} text="Full view" />}>
        <TrendChart months={d.trends} currency={c} />
      </Panel>

      {official && (
        <Panel title="Recent journal entries" flush actions={can('LEDGER_VIEW') && <SeeAll href="/ledger/journal" text="Journal" />}>
          {official.recentEntries.length === 0 ? <p className="p-[var(--panel-p)] text-sm text-muted-foreground">No entries yet.</p> : (
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
                {official.recentEntries.map((e) => (
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
      )}
    </div>
  );
}
