'use client';

import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DateRangeParams, MemberAccountStatementView } from '@/api/types';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { MoneyText, PageHeader, StatusChip } from '@/components/shared/Display';
import { Identifier } from '@/components/shared/Identifier';
import { KeyValue } from '@/components/shared/Panel';
import { StatementDocument } from '@/components/shared/Statement';
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
  // The account statement has no generated time from the API: stamp it when the data arrived.
  const generatedAt = q.dataUpdatedAt ? new Date(q.dataUpdatedAt).toISOString() : null;

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
    <div className="report space-y-3">
      <PageHeader
        back={back}
        title={s ? s.account.productName : 'Statement'}
        description={s && <><Identifier value={s.account.accountNumber} label="account number" sensitive copy={false} />{showMember && <> · {memberLabel(s.account.memberName, s.account.memberNumber)}</>}</>}
        actions={
          <>
            {s && actions?.(s)}
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!s}><Download />CSV</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer />Print</Button>
          </>
        }
      />
      <div className="no-print"><DateRangeFilter value={range} onChange={setRange} /></div>
      {!s ? <LoadingState /> : (
        <StatementDocument
          title="Statement of account"
          from={s.from ?? range.from}
          to={s.to ?? range.to}
          generatedAt={generatedAt}
          subject={
            <>
              <p className="text-base font-semibold">{memberLabel(s.account.memberName, s.account.memberNumber)}</p>
              <p className="text-muted-foreground">{s.account.productName} · {label(s.account.productKind)}</p>
              <p className="text-muted-foreground">Account <Identifier value={s.account.accountNumber} label="account number" sensitive /></p>
            </>
          }
          summary={
            <div className="rounded-md border px-3">
              <KeyValue
                items={[
                  { label: 'Opening balance', value: <MoneyText value={s.openingBalanceMinor} currency={s.account.currency} /> },
                  { label: 'Money in', value: <MoneyText value={s.lines.reduce((t, l) => t + l.creditMinor, 0)} currency={s.account.currency} /> },
                  { label: 'Money out', value: <MoneyText value={s.lines.reduce((t, l) => t + l.debitMinor, 0)} currency={s.account.currency} /> },
                  { label: 'Closing balance', value: <MoneyText value={s.closingBalanceMinor} currency={s.account.currency} />, emphasis: true },
                  { label: 'Status', value: <StatusChip status={s.account.status} /> },
                  { label: 'Opened', value: formatDate(s.account.openedOn) },
                  s.account.closedOn ? { label: 'Closed', value: `${formatDate(s.account.closedOn)}${s.account.closureReason ? ` · ${s.account.closureReason}` : ''}` } : null,
                ]}
              />
            </div>
          }
        >
          <StatementTable
            currency={s.account.currency}
            opening={s.openingBalanceMinor}
            closing={s.closingBalanceMinor}
            linkEntries={showMember}
            lines={s.lines.map((l) => ({ ...l, date: l.entryDate }))}
          />
        </StatementDocument>
      )}
    </div>
  );
}
