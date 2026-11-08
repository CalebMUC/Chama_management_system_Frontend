'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/api/endpoints/books';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { MoneyText } from '@/components/shared/Display';
import { ReportFrame } from '@/features/reports/ReportFrame';
import { SECTION_CSV, SectionTable, sectionRows } from '@/features/reports/SectionTable';
import { downloadCsv } from '@/lib/csv';
import { formatDate, fractionDigits, startOfYearNairobi, todayNairobi } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function IncomeStatementPage() {
  const [range, setRange] = useState<DateRangeValue>({ from: startOfYearNairobi(), to: todayNairobi() });
  const q = useQuery({ queryKey: ['reports', 'incomeStatement', range], queryFn: () => reportsApi.incomeStatement(range) });
  const r = q.data;
  const deficit = !!r && r.surplusMinor < 0;
  return (
    <ReportFrame
      back={{ href: '/reports', label: 'Reports' }}
      title="Income statement"
      description={r && `${r.chamaName} · ${formatDate(r.from)} to ${formatDate(r.to)}`}
      params={<DateRangeFilter value={range} onChange={setRange} />}
      onCsv={r ? () => downloadCsv(`income-statement-${r.from}-${r.to}`, [...sectionRows([{ name: 'Income', section: r.income }, { name: 'Expenses', section: r.expenses }], fractionDigits(r.currency)), { section: '', code: '', name: deficit ? 'Deficit' : 'Surplus', amount: r.surplusMinor / 10 ** fractionDigits(r.currency) }], SECTION_CSV) : undefined}
      onRefresh={() => q.refetch()}
      isLoading={q.isLoading}
      error={q.error}
      generatedAt={r?.generatedAt}
    >
      {r && (
        <div className="max-w-3xl space-y-5">
          <SectionTable title="Income" section={r.income} currency={r.currency} />
          <SectionTable title="Expenses" section={r.expenses} currency={r.currency} />
          <div className={cn('flex justify-between rounded-lg border px-4 py-3 text-lg font-semibold', deficit ? 'border-destructive/40 bg-destructive/5' : 'border-success/40 bg-success/5')}>
            <span>{deficit ? 'Deficit' : 'Surplus'}</span>
            <MoneyText value={r.surplusMinor} currency={r.currency} />
          </div>
        </div>
      )}
    </ReportFrame>
  );
}
