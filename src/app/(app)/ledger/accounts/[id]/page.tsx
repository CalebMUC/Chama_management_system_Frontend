'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ledgerApi } from '@/api/endpoints/books';
import { Guard } from '@/components/shared/Can';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { StatementTable } from '@/components/shared/StatementTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/primitives';
import { ReportFrame } from '@/features/reports/ReportFrame';
import { useMemberDirectory } from '@/hooks/useMembers';
import { csvMoney, downloadCsv } from '@/lib/csv';
import { fractionDigits } from '@/lib/format';
import { label } from '@/lib/labels';

export default function LedgerAccountPage() {
  return (
    <Guard permission="LEDGER_VIEW">
      <LedgerAccount />
    </Guard>
  );
}

/** README §7.12: an account's statement; member-ledger accounts can be filtered to one member. */
function LedgerAccount() {
  const { id } = useParams<{ id: string }>();
  const directory = useMemberDirectory();
  const [range, setRange] = useState<DateRangeValue>({});
  const [member, setMember] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['ledger', 'statement', id, range, member], queryFn: () => ledgerApi.statement(id, { ...range, memberUserId: member ?? undefined }) });
  const s = q.data;

  function exportCsv() {
    if (!s) return;
    const digits = fractionDigits(s.account.currency);
    downloadCsv(`account-${s.account.code}`, s.lines, [
      { header: 'Date', value: (l) => l.entryDate },
      { header: 'Entry', value: (l) => l.entryNumber },
      { header: 'Description', value: (l) => l.description },
      { header: 'Reference', value: (l) => l.reference },
      { header: 'Member', value: (l) => (l.memberUserId ? directory.nameOf(l.memberUserId) : '') },
      { header: 'Memo', value: (l) => l.memo },
      { header: 'Debit', value: (l) => csvMoney(l.debitMinor, digits) },
      { header: 'Credit', value: (l) => csvMoney(l.creditMinor, digits) },
      { header: 'Balance', value: (l) => csvMoney(l.balanceMinor, digits) },
    ]);
  }

  return (
    <ReportFrame
      back={{ href: '/ledger/accounts', label: 'Chart of accounts' }}
      title={s ? `${s.account.code} · ${s.account.name}` : 'Account'}
      description={s && <span className="flex flex-wrap gap-1.5"><Badge variant="outline">{label(s.account.type)}</Badge>{s.account.memberLedger && <Badge variant="outline">Member ledger</Badge>}{member && <Badge>{directory.nameOf(member)}</Badge>}</span>}
      params={
        <>
          <DateRangeFilter value={range} onChange={setRange} />
          {s?.account.memberLedger && (
            <>
              <div className="w-full sm:w-64"><MemberPicker value={member} onChange={(m) => setMember(m)} statuses={['ACTIVE', 'SUSPENDED', 'EXITED']} placeholder="All members" /></div>
              {member && <Button variant="ghost" size="sm" onClick={() => setMember(null)}>All members</Button>}
            </>
          )}
        </>
      }
      onCsv={exportCsv}
      onRefresh={() => q.refetch()}
      isLoading={q.isLoading}
      error={q.error}
    >
      {s && (
        <StatementTable
          currency={s.account.currency}
          opening={s.openingBalanceMinor}
          closing={s.closingBalanceMinor}
          linkEntries
          lines={s.lines.map((l) => ({ ...l, date: l.entryDate, memo: [l.memberUserId && !member ? directory.nameOf(l.memberUserId) : null, l.memo].filter(Boolean).join(' · ') || null }))}
        />
      )}
    </ReportFrame>
  );
}
