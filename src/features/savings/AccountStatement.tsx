'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DateRangeParams, MemberAccountStatementView } from '@/api/types';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { DetailList, MoneyText, PageHeader, StatusChip } from '@/components/shared/Display';
import { StatementTable } from '@/components/shared/StatementTable';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { csvMoney, downloadCsv } from '@/lib/csv';
import { formatDate, fractionDigits, memberLabel } from '@/lib/format';
import { label } from '@/lib/labels';
import { Download, Printer } from 'lucide-react';

/** A member account's statement with a date range (README §7.7). Used by members (own) and officials (any). */
export function AccountStatement({ queryKey, load, back, actions, showMember }: {
  queryKey: unknown[];
  load(params: DateRangeParams): Promise<MemberAccountStatementView>;
  back: { href: string; label: string };
  actions?: (s: MemberAccountStatementView) => ReactNode;
  showMember?: boolean;
}) {
  const [range, setRange] = useState<DateRangeValue>({});
  const q = useQuery({ queryKey: [...queryKey, range], queryFn: () => load(range) });
  const s = q.data;

  function exportCsv() {
    if (!s) return;
    const digits = fractionDigits(s.account.currency);
    downloadCsv(`statement-${s.account.accountNumber}`, s.lines, [
      { header: 'Date', value: (l) => l.entryDate },
      { header: 'Entry', value: (l) => l.entryNumber },
      { header: 'Description', value: (l) => l.description },
      { header: 'Reference', value: (l) => l.reference },
      { header: 'Debit', value: (l) => csvMoney(l.debitMinor, digits) },
      { header: 'Credit', value: (l) => csvMoney(l.creditMinor, digits) },
      { header: 'Balance', value: (l) => csvMoney(l.balanceMinor, digits) },
    ]);
  }

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="report space-y-5">
      <PageHeader
        back={back}
        title={s ? s.account.productName : 'Statement'}
        description={s && <>{s.account.accountNumber}{showMember && <> · {memberLabel(s.account.memberName, s.account.memberNumber)}</>}</>}
        actions={
          <>
            {s && actions?.(s)}
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!s}><Download />CSV</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer />Print</Button>
          </>
        }
      />
      {s && (
        <div className="rounded-lg border bg-card p-4">
          <DetailList
            columns={4}
            items={[
              { label: 'Balance', value: <MoneyText value={s.account.balanceMinor} currency={s.account.currency} className="font-semibold" /> },
              { label: 'Status', value: <StatusChip status={s.account.status} /> },
              { label: 'Product', value: `${s.account.productCode} · ${label(s.account.productKind)}` },
              { label: 'Opened', value: formatDate(s.account.openedOn) },
              s.account.closedOn ? { label: 'Closed', value: `${formatDate(s.account.closedOn)}${s.account.closureReason ? ` · ${s.account.closureReason}` : ''}` } : null,
            ]}
          />
        </div>
      )}
      <div className="no-print"><DateRangeFilter value={range} onChange={setRange} /></div>
      {!s ? <LoadingState /> : (
        <StatementTable
          currency={s.account.currency}
          opening={s.openingBalanceMinor}
          closing={s.closingBalanceMinor}
          linkEntries={showMember}
          lines={s.lines.map((l) => ({ ...l, date: l.entryDate }))}
        />
      )}
    </div>
  );
}
