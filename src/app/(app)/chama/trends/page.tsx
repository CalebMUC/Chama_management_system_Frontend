'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { dashboardApi, dashboardKeys } from '@/api/endpoints/books';
import { PageHeader } from '@/components/shared/Display';
import { Panel } from '@/components/shared/Panel';
import { ErrorState } from '@/components/shared/States';
import { Skeleton } from '@/components/ui/primitives';
import { DASHBOARD_ROUTES, RedirectGuard, Segmented } from '@/features/dashboard/Ranked';
import { monthLabel, TrendChart, TrendTable } from '@/features/dashboard/TrendChart';

export default function TrendsPage() {
  return (
    <RedirectGuard permission="REPORT_VIEW_ALL">
      <Trends />
    </RedirectGuard>
  );
}

const RANGES = [6, 12, 24] as const;
type Months = (typeof RANGES)[number];

/** GET /dashboard/trends (DASHBOARDS.md "Trends"): the full view, 6 / 12 / 24 months, kept in the URL. */
function Trends() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const asked = Number(params.get('months'));
  const months: Months = (RANGES as readonly number[]).includes(asked) ? (asked as Months) : 12;
  const q = useQuery({
    queryKey: dashboardKeys.trends(months),
    queryFn: () => dashboardApi.trends(months),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
  });
  const v = q.data;
  const first = v?.months[0];
  const last = v?.months[v.months.length - 1];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Trends"
        description={first && last ? `${monthLabel(first.month, false)} – ${monthLabel(last.month, true)}` : 'Month by month'}
        back={{ href: DASHBOARD_ROUTES.overview, label: 'Chama overview' }}
        actions={
          <Segmented<Months>
            label="Months to show"
            value={months}
            onChange={(n) => router.replace(n === 12 ? pathname : `${pathname}?months=${n}`, { scroll: false })}
            options={RANGES.map((n) => ({ value: n, label: `${n} months` }))}
          />
        }
      />
      {q.error && !v ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !v ? (
        <Skeleton className="h-80" />
      ) : (
        <>
          <Panel title="Contributions, loans, income and expenses">
            <TrendChart months={v.months} currency={v.currency} height={320} tableToggle={false} dimmed={q.isPlaceholderData} />
          </Panel>
          <Panel title="By month" flush description="Newest first.">
            <TrendTable months={v.months} currency={v.currency} />
          </Panel>
        </>
      )}
    </div>
  );
}
