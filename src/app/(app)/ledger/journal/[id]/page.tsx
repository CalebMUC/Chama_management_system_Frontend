'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Info, Undo2 } from 'lucide-react';
import { ledgerApi } from '@/api/endpoints/books';
import type { EntryView } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { Guard } from '@/components/shared/Can';
import { Identifier } from '@/components/shared/Identifier';
import { KpiStrip, KpiTile } from '@/components/shared/Kpi';
import { Panel } from '@/components/shared/Panel';
import { DetailList, MoneyText, PageHeader } from '@/components/shared/Display';
import { ReasonDialog } from '@/components/shared/ReasonDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, Badge, Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useMemberDirectory } from '@/hooks/useMembers';
import { useCan } from '@/hooks/useSessionInfo';
import { formatDate, formatInstant } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { label } from '@/lib/labels';

export default function EntryPage() {
  return (
    <Guard permission="LEDGER_VIEW">
      <Entry />
    </Guard>
  );
}

/** Where to see the business record behind an entry. */
function sourceLink(e: EntryView): { href: string; text: string } | null {
  if (!e.sourceId) return null;
  switch (e.sourceType) {
    case 'CONTRIBUTION': return { href: '/contributions', text: 'the contribution payment' };
    case 'PENALTY': case 'PENALTY_PAYMENT': case 'PENALTY_WAIVER': return { href: `/penalties/${e.sourceId}`, text: 'the penalty' };
    case 'LOAN_DISBURSEMENT': case 'LOAN_REPAYMENT': return { href: `/loans/${e.sourceId}`, text: 'the loan' };
    case 'EXPENSE': return { href: `/expenses/${e.sourceId}`, text: 'the expense' };
    default:
      if (e.sourceType.startsWith('INVESTMENT_')) return { href: `/investments/${e.sourceId}`, text: 'the investment' };
      return null;
  }
}

/** README §7.12: entry detail. Only manual entries are reversed here; business records are reversed from their own screens. */
function Entry() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const directory = useMemberDirectory();
  const [reversing, setReversing] = useState(false);
  const q = useQuery({ queryKey: ['ledger', 'entry', id], queryFn: () => ledgerApi.entry(id) });
  const reverse = useApiMutation((reason: string) => ledgerApi.reverse(id, reason), { invalidate: keys('ledger'), toastErrors: false });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  const e = q.data;
  const debits = e.lines.reduce((s, l) => s + l.debitMinor, 0);
  const credits = e.lines.reduce((s, l) => s + l.creditMinor, 0);
  const link = sourceLink(e);
  const canReverse = e.sourceType === 'MANUAL' && !e.reversedByEntryId && can('LEDGER_POST');

  return (
    <div className="space-y-3">
      <PageHeader
        back={{ href: '/ledger/journal', label: 'Journal' }}
        title={<span className="flex flex-wrap items-center gap-2">Entry #{e.number}<Badge variant="outline">{label(e.sourceType)}</Badge>{e.reversedByEntryId && <Badge variant="secondary">Reversed</Badge>}</span>}
        description={e.description}
        actions={canReverse && <Button variant="outline" onClick={() => setReversing(true)}><Undo2 />Reverse</Button>}
      />
      <KpiStrip min={170} compact={false}>
        <KpiTile label="Entry" value={<Identifier value={`#${e.number}`} label="journal entry number" />} hint={formatDate(e.entryDate)} />
        <KpiTile label="Amount (Dr = Cr)" value={<MoneyText value={e.totalMinor} />} hint={`${e.lines.length} posting lines`} />
        <KpiTile label="Source" value={<span className="text-base">{label(e.sourceType)}</span>} hint={e.reference ? <>Ref <Identifier value={e.reference} /></> : 'No reference'} />
        <KpiTile
          label="Balance check"
          value={<span className={debits === credits ? 'text-base text-success' : 'text-base text-destructive'}>{debits === credits ? 'Balanced' : 'Out of balance'}</span>}
          hint={e.reversedByEntryId ? 'Reversed' : e.reversesEntryId ? 'A reversal' : 'Posted'}
          tone={debits === credits ? 'success' : 'destructive'}
        />
      </KpiStrip>
      <Panel title="Entry details">
        <DetailList
          columns={4}
          items={[
            { label: 'Value date', value: formatDate(e.entryDate) },
            { label: 'Reference', value: e.reference ? <Identifier value={e.reference} /> : '—' },
            { label: 'Recorded', value: `${formatInstant(e.recordedAt)} · ${directory.nameOf(e.recordedBy)}` },
            { label: 'Total', value: <MoneyText value={e.totalMinor} className="font-semibold" /> },
            e.reversesEntryId ? { label: 'Reverses', value: <Link className="text-primary hover:underline" href={`/ledger/journal/${e.reversesEntryId}`}>the original entry</Link> } : null,
            e.reversedByEntryId ? { label: 'Reversed by', value: <Link className="text-primary hover:underline" href={`/ledger/journal/${e.reversedByEntryId}`}>its reversal</Link> } : null,
          ]}
        />
      </Panel>
      {e.sourceType !== 'MANUAL' && e.sourceType !== 'REVERSAL' && e.sourceType !== 'OPENING_BALANCE' && (
        <Alert>
          <Info />
          <AlertDescription>
            This entry was made by a business record. To undo it, act on {link ? <Link className="font-medium text-primary underline" href={link.href}>{link.text}</Link> : 'that record'} instead of here.
          </AlertDescription>
        </Alert>
      )}
      <Panel title="Postings" flush>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Account</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead className="text-right">Debit (Dr)</TableHead>
              <TableHead className="text-right">Credit (Cr)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {e.lines.map((l, i) => (
              <TableRow key={i}>
                <TableCell><Link className="hover:underline" href={`/ledger/accounts/${l.accountId}`}><span className="ident mr-1.5 text-muted-foreground">{l.accountCode}</span>{l.accountName}</Link></TableCell>
                <TableCell>{l.memberUserId ? directory.nameOf(l.memberUserId) : ''}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.memo ?? ''}</TableCell>
                <TableCell className="text-right">{l.debitMinor ? <Amount value={l.debitMinor} bare /> : ''}</TableCell>
                <TableCell className="text-right">{l.creditMinor ? <Amount value={l.creditMinor} bare /> : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={3}>Totals</TableCell>
              <TableCell className="text-right"><Amount value={debits} bare /></TableCell>
              <TableCell className="text-right"><Amount value={credits} bare /></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Panel>
      <ReasonDialog
        open={reversing}
        onOpenChange={setReversing}
        title={`Reverse entry #${e.number}?`}
        description="A new entry with the opposite lines is posted today. The original stays in the journal."
        confirmLabel="Reverse entry"
        onConfirm={(reason) => reverse.mutateAsync(reason)}
      />
    </div>
  );
}
