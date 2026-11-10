'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { dashboardApi, dashboardKeys } from '@/api/endpoints/books';
import { normaliseError } from '@/api/errors';
import { Amount } from '@/components/shared/Amount';
import { Can } from '@/components/shared/Can';
import { PageHeader, StatusChip } from '@/components/shared/Display';
import { Panel } from '@/components/shared/Panel';
import { ErrorState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/overlays';
import { Badge, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { RankBadge, RedirectGuard, ReturnFigure, SignedRate } from '@/features/dashboard/Ranked';
import { ProposeDialog } from '@/features/investments/ProposeDialog';
import { formatDate, plural } from '@/lib/format';
import { label } from '@/lib/labels';

export default function TopInvestmentsPage() {
  return (
    <RedirectGuard permission="INVESTMENT_VIEW" feature="INVESTMENTS">
      <TopInvestments />
    </RedirectGuard>
  );
}

/** The full ranking: the server clamps limit to 1–50. */
const FULL = 50;

/** GET /dashboard/top-investments (DASHBOARDS.md "Top investments"): every funded investment, active or closed, by return. */
function TopInvestments() {
  const router = useRouter();
  const [proposing, setProposing] = useState(false);
  const q = useQuery({ queryKey: dashboardKeys.topInvestments(FULL), queryFn: () => dashboardApi.topInvestments(FULL), refetchOnWindowFocus: true });
  const code = q.error ? normaliseError(q.error).code : null;
  useEffect(() => {
    if (code === 'ACCESS_DENIED' || code === 'LICENSE_FEATURE_NOT_INCLUDED') router.replace('/home');
  }, [code, router]);

  const v = q.data;
  return (
    <div className="space-y-3">
      <PageHeader
        title="Top investments"
        description="Every funded investment, active or closed, ranked by return on what was put in."
      />
      {q.error && !v ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <Panel flush footer="Return = income − expenses + gain in value. The gain is realised on closed investments; on active ones it is the latest valuation less book value.">
          {!v ? (
            <div className="space-y-2 p-[var(--panel-p)]">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : v.investments.length === 0 ? (
            <div className="px-[var(--panel-p)] py-10 text-center text-sm text-muted-foreground">
              <p>No funded investments yet.</p>
              <Can permission="INVESTMENT_MANAGE"><Button size="sm" className="mt-3" onClick={() => setProposing(true)}><Plus />Propose an investment</Button></Can>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Investment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Invested</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right" aria-sort="descending">Return</TableHead>
                    <TableHead className="text-right">Per year</TableHead>
                    <TableHead>Held</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {v.investments.map((i) => (
                    <TableRow key={i.investmentId}>
                      <TableCell><RankBadge rank={i.rank} /></TableCell>
                      <TableCell className="min-w-[12rem]">
                        <Link href={`/investments/${i.investmentId}`} className="font-medium hover:underline">{i.name}</Link>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <Badge variant="outline">{label(i.type)}</Badge>
                          {i.institution}
                        </span>
                      </TableCell>
                      <TableCell><StatusChip status={i.status} /></TableCell>
                      <TableCell className="text-right"><Amount value={i.investedMinor} currency={v.currency} bare sensitive={false} /></TableCell>
                      <TableCell className="text-right"><Amount value={i.marketValueMinor} currency={v.currency} bare sensitive={false} /></TableCell>
                      <TableCell className="text-right"><Amount value={i.incomeMinor} currency={v.currency} bare sensitive={false} /></TableCell>
                      <TableCell className="text-right"><Amount value={i.expensesMinor} currency={v.currency} bare sensitive={false} /></TableCell>
                      <TableCell className="text-right"><ReturnFigure inv={i} currency={v.currency} stacked /></TableCell>
                      <TableCell className="text-right">
                        {i.annualisedReturnBasisPoints === null
                          ? <Tooltip content="Held under 30 days"><span className="cursor-help text-muted-foreground">—</span></Tooltip>
                          : <SignedRate bp={i.annualisedReturnBasisPoints} />}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Tooltip content={<>Funded {formatDate(i.fundedOn)}{i.maturityDate ? ` · matures ${formatDate(i.maturityDate)}` : ''}</>}>
                          <span className="cursor-help tabular">{plural(i.daysHeld, 'day')}</span>
                        </Tooltip>
                        {i.maturityDate && <span className="block text-xs text-muted-foreground">Matures {formatDate(i.maturityDate)}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      )}
      <ProposeDialog open={proposing} onOpenChange={setProposing} onCreated={(id) => router.push(`/investments/${id}`)} />
    </div>
  );
}
