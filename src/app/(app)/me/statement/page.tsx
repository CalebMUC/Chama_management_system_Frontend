'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/endpoints/books';
import { Guard } from '@/components/shared/Can';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { MemberStatementBody, memberStatementCsv } from '@/features/reports/MemberStatementBody';
import { ReportFrame } from '@/features/reports/ReportFrame';
import { startOfYearNairobi, todayNairobi } from '@/lib/format';

export default function MyStatementPage() {
  return (
    <Guard feature="REPORTS">
      <MyStatement />
    </Guard>
  );
}

function MyStatement() {
  const [range, setRange] = useState<DateRangeValue>({ from: startOfYearNairobi(), to: todayNairobi() });
  const q = useQuery({ queryKey: ['reports', 'memberStatement', 'me', range], queryFn: () => reportsApi.myStatement(range) });
  return (
    <ReportFrame
      title="My statement"
      description="Everything you have with the chama: savings, loans and penalties."
      params={<DateRangeFilter value={range} onChange={setRange} />}
      onCsv={q.data ? () => memberStatementCsv(q.data!) : undefined}
      onRefresh={() => q.refetch()}
      isLoading={q.isLoading}
      error={q.error}
      generatedAt={q.data?.generatedAt}
    >
      {q.data && <MemberStatementBody s={q.data} />}
    </ReportFrame>
  );
}
