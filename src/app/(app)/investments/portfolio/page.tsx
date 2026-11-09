'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Briefcase, Coins, LineChart, TrendingUp } from 'lucide-react';
import { investmentsApi } from '@/api/endpoints/spending';
import { Guard } from '@/components/shared/Can';
import { AllocationDonut } from '@/components/shared/AllocationDonut';
import { DetailList, MoneyText, PageHeader, Section, SignedMoney, StatCard } from '@/components/shared/Display';
import { KpiStrip } from '@/components/shared/Kpi';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/States';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { INVESTMENT_TYPES } from '@/features/investments/ProposeDialog';
import { formatBp, formatDate } from '@/lib/format';
import { label } from '@/lib/labels';

export default function PortfolioPage() {
  return (
    <Guard permission="INVESTMENT_VIEW" feature="INVESTMENTS">
      <Portfolio />
    </Guard>
  );
}

/** README §7.11: the whole portfolio. */
function Portfolio() {
  const q = useQuery({ queryKey: ['investments', 'portfolio'], queryFn: investmentsApi.portfolio });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  const p = q.data;
  const c = p.currency;
  // Fixed hue per type (its position in the type list); OTHER is the neutral "other" grey.
  const donut = p.byType.map((t) => ({ key: t.type, label: label(t.type), value: t.marketValueMinor, slot: t.type === 'OTHER' ? -1 : INVESTMENT_TYPES.indexOf(t.type) }));

  return (
    <div className="space-y-5">
      <PageHeader back={{ href: '/investments', label: 'Investments' }} title="Portfolio" description={`${p.activeCount} active investment${p.activeCount === 1 ? '' : 's'}`} />
      <KpiStrip>
        <StatCard label="Market value" value={<MoneyText value={p.marketValueMinor} currency={c} />} hint={<>Book value <MoneyText value={p.bookValueMinor} currency={c} /></>} icon={<Briefcase />} />
        <StatCard label="Invested" value={<MoneyText value={p.investedMinor} currency={c} />} icon={<Coins />} />
        <StatCard label="Total return" value={<SignedMoney value={p.totalReturnMinor} currency={c} />} hint={formatBp(p.returnBasisPoints)} icon={<TrendingUp />} tone={p.totalReturnMinor >= 0 ? 'success' : 'destructive'} />
        <StatCard label="Income" value={<MoneyText value={p.incomeMinor} currency={c} />} hint={<>Expenses <MoneyText value={p.expensesMinor} currency={c} /></>} icon={<LineChart />} />
      </KpiStrip>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Allocation by type" description="Market value of active investments">
          <AllocationDonut items={donut} currency={c} centerLabel="Market value" />
        </Section>
        <Section title="Gains">
          <DetailList
            items={[
              { label: 'Realised gain', value: <SignedMoney value={p.realisedGainMinor} currency={c} /> },
              { label: 'Unrealised gain', value: <SignedMoney value={p.unrealisedGainMinor} currency={c} /> },
              { label: 'Income', value: <MoneyText value={p.incomeMinor} currency={c} /> },
              { label: 'Expenses', value: <MoneyText value={p.expensesMinor} currency={c} /> },
              { label: 'Total return', value: <SignedMoney value={p.totalReturnMinor} currency={c} /> },
              { label: 'Return', value: formatBp(p.returnBasisPoints) },
            ]}
          />
        </Section>
      </div>
      <Section title="Maturing in the next 30 days">
        {p.maturingWithin30Days.length === 0 ? <EmptyState title="Nothing matures soon" className="py-6" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Investment</TableHead>
                  <TableHead>Matures</TableHead>
                  <TableHead className="text-right">Book value</TableHead>
                  <TableHead className="text-right">Market value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.maturingWithin30Days.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell><Link href={`/investments/${i.id}`} className="font-medium text-primary hover:underline">{i.name}</Link><span className="block text-xs text-muted-foreground">{label(i.type)}</span></TableCell>
                    <TableCell>{formatDate(i.maturityDate)}</TableCell>
                    <TableCell className="text-right"><MoneyText value={i.bookValueMinor} currency={c} /></TableCell>
                    <TableCell className="text-right"><MoneyText value={i.marketValueMinor} currency={c} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  );
}
