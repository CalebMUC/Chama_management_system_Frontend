'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { dashboardApi, dashboardKeys } from '@/api/endpoints/books';
import { normaliseError } from '@/api/errors';
import { Amount } from '@/components/shared/Amount';
import { DateRangeFilter } from '@/components/shared/DateRange';
import { PageHeader } from '@/components/shared/Display';
import { Panel } from '@/components/shared/Panel';
import { ErrorState, FormAlert } from '@/components/shared/States';
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { ComplianceBar, DASHBOARD_ROUTES, RankBadge, RedirectGuard, Segmented } from '@/features/dashboard/Ranked';
import { formatDate, startOfMonthNairobi, startOfYearNairobi, todayNairobi } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function TopMembersPage() {
  return (
    <RedirectGuard permission="REPORT_VIEW_ALL" feature="CONTRIBUTIONS" featureFallback={DASHBOARD_ROUTES.overview}>
      <TopMembers />
    </RedirectGuard>
  );
}

type Preset = 'month' | 'year' | 'lastYear' | 'custom';
const LIMITS = [10, 25, 50] as const;

function presetRange(p: Exclude<Preset, 'custom'>): { from: string; to: string } {
  const today = todayNairobi();
  if (p === 'month') return { from: startOfMonthNairobi(), to: today };
  if (p === 'year') return { from: startOfYearNairobi(), to: today };
  const last = Number(today.slice(0, 4)) - 1;
  return { from: `${last}-01-01`, to: `${last}-12-31` };
}

/** Which preset a range matches; "This year" when the URL has none (the server's default). */
function presetOf(from: string | null, to: string | null): Preset {
  if (!from && !to) return 'year';
  for (const p of ['month', 'year', 'lastYear'] as const) {
    const r = presetRange(p);
    if (r.from === from && r.to === to) return p;
  }
  return 'custom';
}

/** GET /dashboard/top-members (DASHBOARDS.md "Top members"). The range is kept in the URL so it can be shared. */
function TopMembers() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const from = params.get('from');
  const to = params.get('to');
  const limitParam = Number(params.get('limit'));
  const limit = (LIMITS as readonly number[]).includes(limitParam) ? limitParam : 10;
  // "Custom" stays chosen even while its dates happen to match a preset, so the picker doesn't vanish mid-edit.
  const [customChosen, setCustomChosen] = useState(false);
  const preset: Preset = customChosen ? 'custom' : presetOf(from, to);
  const invalid = !!from && !!to && from > to;

  const setParams = (next: { from?: string | null; to?: string | null; limit?: number }) => {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === undefined || v === '' || (k === 'limit' && v === 10)) sp.delete(k);
      else sp.set(k, String(v));
    }
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const q = useQuery({
    queryKey: dashboardKeys.topMembers(from ?? undefined, to ?? undefined, limit),
    queryFn: () => dashboardApi.topMembers({ from: from ?? undefined, to: to ?? undefined, limit }),
    enabled: !invalid,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });

  // The licence lost CONTRIBUTIONS since the session loaded: back to the overview.
  const code = q.error ? normaliseError(q.error).code : null;
  useEffect(() => {
    if (code === 'LICENSE_FEATURE_NOT_INCLUDED') router.replace(DASHBOARD_ROUTES.overview);
    if (code === 'ACCESS_DENIED') router.replace('/home');
  }, [code, router]);

  const v = q.data;
  return (
    <div className="space-y-3">
      <PageHeader
        title="Top members"
        description={v ? `Ranked by contributions, ${formatDate(v.from)} – ${formatDate(v.to)}` : 'Ranked by contributions'}
        back={{ href: DASHBOARD_ROUTES.overview, label: 'Chama overview' }}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
        <Segmented<Preset>
          label="Date range"
          value={preset}
          onChange={(p) => {
            setCustomChosen(p === 'custom');
            if (p === 'custom') setParams({ from: from ?? startOfYearNairobi(), to: to ?? todayNairobi() });
            else if (p === 'year') setParams({ from: null, to: null });
            else setParams(presetRange(p));
          }}
          options={[
            { value: 'month', label: 'This month' },
            { value: 'year', label: 'This year' },
            { value: 'lastYear', label: 'Last year' },
            { value: 'custom', label: 'Custom' },
          ]}
        />
        {preset === 'custom' && <DateRangeFilter value={{ from: from ?? undefined, to: to ?? undefined }} onChange={(r) => setParams({ from: r.from ?? null, to: r.to ?? null })} />}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Show
          <Segmented label="Rows to show" value={limit} onChange={(n) => setParams({ limit: n })} options={LIMITS.map((n) => ({ value: n, label: String(n) }))} />
        </div>
      </div>

      {invalid ? (
        <FormAlert messages={['The start date must be on or before the end date.']} />
      ) : q.error && code !== 'REPORT_INVALID_PERIOD' && !v ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <Panel flush footer="Compliance, arrears, late periods and savings are as of today, whatever range is chosen.">
          {code === 'REPORT_INVALID_PERIOD' && <div className="p-[var(--panel-p)]"><FormAlert error={q.error} /></div>}
          {!v ? (
            <div className="space-y-2 p-[var(--panel-p)]">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
          ) : v.members.length === 0 ? (
            <p className="px-[var(--panel-p)] py-10 text-center text-sm text-muted-foreground">No contributions recorded between {formatDate(v.from)} and {formatDate(v.to)}.</p>
          ) : (
            <div className={cn('overflow-x-auto transition-opacity', q.isPlaceholderData && 'opacity-60')}>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right" aria-sort="descending">Contributed</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                    <TableHead className="w-44">Compliance</TableHead>
                    <TableHead className="text-right">Arrears</TableHead>
                    <TableHead className="text-right">Late periods</TableHead>
                    <TableHead className="text-right">Savings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {v.members.map((m) => (
                    <TableRow key={m.memberUserId}>
                      <TableCell><RankBadge rank={m.rank} /></TableCell>
                      <TableCell className="min-w-[10rem]">
                        <Link href={`/members/${m.memberUserId}`} className="font-medium hover:underline">{m.name}</Link>
                        {m.memberNumber !== null && <span className="ml-1.5 text-xs text-muted-foreground">#{m.memberNumber}</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium"><Amount value={m.contributedMinor} currency={v.currency} bare sensitive={false} /></TableCell>
                      <TableCell className="text-right tabular">{m.payments}</TableCell>
                      <TableCell><ComplianceBar bp={m.complianceRateBasisPoints} /></TableCell>
                      <TableCell className="text-right"><Amount value={m.arrearsMinor} currency={v.currency} bare sensitive={false} className={m.arrearsMinor > 0 ? 'text-destructive' : undefined} /></TableCell>
                      <TableCell className={cn('text-right tabular', m.latePeriods > 0 && 'text-destructive')}>{m.latePeriods}</TableCell>
                      <TableCell className="text-right"><Amount value={m.savingsMinor} currency={v.currency} bare sensitive={false} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
