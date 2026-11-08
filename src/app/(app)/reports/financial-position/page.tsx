'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { reportsApi } from '@/api/endpoints/books';
import { MoneyText } from '@/components/shared/Display';
import { Badge, Input } from '@/components/ui/primitives';
import { Param, ReportFrame } from '@/features/reports/ReportFrame';
import { SECTION_CSV, SectionTable, sectionRows } from '@/features/reports/SectionTable';
import { downloadCsv } from '@/lib/csv';
import { formatDate, fractionDigits, todayNairobi } from '@/lib/format';

export default function FinancialPositionPage() {
  const [asOf, setAsOf] = useState(todayNairobi());
  const q = useQuery({ queryKey: ['reports', 'financialPosition', asOf], queryFn: () => reportsApi.financialPosition(asOf) });
  const r = q.data;
  return (
    <ReportFrame
      back={{ href: '/reports', label: 'Reports' }}
      title="Statement of financial position"
      description={r && <span className="flex flex-wrap items-center gap-2">{r.chamaName} · as of {formatDate(r.asOf)} {r.balanced ? <Badge variant="success"><CheckCircle2 className="size-3" />Balanced</Badge> : <Badge variant="destructive"><XCircle className="size-3" />Not balanced</Badge>}</span>}
      params={<Param label="As of"><Input type="date" value={asOf} max={todayNairobi()} onChange={(e) => e.target.value && setAsOf(e.target.value)} className="w-44" /></Param>}
      onCsv={r ? () => downloadCsv(`financial-position-${r.asOf}`, sectionRows([{ name: 'Assets', section: r.assets }, { name: 'Liabilities', section: r.liabilities }, { name: 'Equity', section: r.equity }], fractionDigits(r.currency)), SECTION_CSV) : undefined}
      onRefresh={() => q.refetch()}
      isLoading={q.isLoading}
      error={q.error}
      generatedAt={r?.generatedAt}
    >
      {r && (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionTable title="Assets" section={r.assets} currency={r.currency} />
          <div className="space-y-5">
            <SectionTable title="Liabilities" section={r.liabilities} currency={r.currency} />
            <SectionTable title="Equity" section={r.equity} currency={r.currency} />
            <div className="flex justify-between rounded-lg border bg-card px-4 py-3 font-semibold">
              <span>Liabilities + equity</span>
              <MoneyText value={r.liabilitiesAndEquityMinor} currency={r.currency} />
            </div>
          </div>
        </div>
      )}
    </ReportFrame>
  );
}
