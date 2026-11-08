'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/endpoints/books';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { EmptyState } from '@/components/shared/States';
import { MemberStatementBody, memberStatementCsv } from '@/features/reports/MemberStatementBody';
import { Param, ReportFrame } from '@/features/reports/ReportFrame';
import { startOfYearNairobi, todayNairobi } from '@/lib/format';

export default function MemberStatementReportPage() {
  const params = useSearchParams();
  const [member, setMember] = useState<string | null>(params.get('member'));
  const [range, setRange] = useState<DateRangeValue>({ from: startOfYearNairobi(), to: todayNairobi() });
  const q = useQuery({ queryKey: ['reports', 'memberStatement', member, range], queryFn: () => reportsApi.memberStatement(member!, range), enabled: !!member });
  return (
    <ReportFrame
      back={{ href: '/reports', label: 'Reports' }}
      title="Member statement"
      params={
        <>
          <Param label="Member"><div className="w-64"><MemberPicker value={member} onChange={(id) => setMember(id)} statuses={['ACTIVE', 'SUSPENDED', 'EXITED']} /></div></Param>
          <DateRangeFilter value={range} onChange={setRange} />
        </>
      }
      onCsv={q.data ? () => memberStatementCsv(q.data!) : undefined}
      onRefresh={member ? () => q.refetch() : undefined}
      isLoading={!!member && q.isLoading}
      error={q.error}
      generatedAt={q.data?.generatedAt}
    >
      {!member ? <EmptyState title="Choose a member" message="Pick a member above to see their statement." /> : q.data && <MemberStatementBody s={q.data} />}
    </ReportFrame>
  );
}
