'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Plus, Undo2 } from 'lucide-react';
import { contributionsApi } from '@/api/endpoints/savings';
import type { ContributionPaymentStatus, PaymentView } from '@/api/types';
import { Can, Guard } from '@/components/shared/Can';
import { DataTable } from '@/components/shared/DataTable';
import { DateRangeFilter, type DateRangeValue } from '@/components/shared/DateRange';
import { DetailList, EntryLink, MoneyText, PageHeader, StatusChip } from '@/components/shared/Display';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { ReasonDialog } from '@/components/shared/ReasonDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/overlays';
import { NativeSelect } from '@/components/ui/primitives';
import { paymentColumns, paymentCsv, PaymentStatus } from '@/features/contributions/paymentColumns';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useMemberDirectory } from '@/hooks/useMembers';
import { usePaged } from '@/hooks/usePaged';
import { useCan, useCurrency, useMyUserId } from '@/hooks/useSessionInfo';
import { formatDate, formatInstant, fractionDigits, memberLabel } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { label } from '@/lib/labels';

export default function ContributionsPage() {
  return (
    <Guard permission="CONTRIBUTION_VIEW_ALL" feature="CONTRIBUTIONS">
      <Payments />
    </Guard>
  );
}

/** README §7.6: every contribution payment, filterable; click for detail and reversal. */
function Payments() {
  const params = useSearchParams();
  const currency = useCurrency();
  const [member, setMember] = useState<string | null>(params.get('member'));
  const [range, setRange] = useState<DateRangeValue>({});
  const [status, setStatus] = useState<ContributionPaymentStatus | ''>('');
  const [openId, setOpenId] = useState<string | null>(null);
  const list = usePaged(['contributions', 'list'], { memberUserId: member ?? undefined, from: range.from, to: range.to, status: status || undefined }, contributionsApi.list);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Contributions"
        description="Payments members made, as recorded by officials."
        actions={<Can permission="CONTRIBUTION_RECORD"><Button asChild><Link href="/contributions/new"><Plus />Record contribution</Link></Button></Can>}
      />
      <DataTable
        columns={paymentColumns(true)}
        getRowId={(p) => p.id}
        onRowClick={(p) => setOpenId(p.id)}
        emptyTitle="No payments"
        emptyMessage="Payments appear here once recorded."
        csv={{ fileName: 'contributions', columns: paymentCsv(fractionDigits(currency)) }}
        toolbar={
          <>
            <div className="w-full sm:w-64"><MemberPicker value={member} onChange={(id) => setMember(id)} statuses={['ACTIVE', 'SUSPENDED', 'EXITED']} placeholder="All members" /></div>
            {member && <Button variant="ghost" size="sm" onClick={() => setMember(null)}>Clear</Button>}
            <DateRangeFilter value={range} onChange={setRange} />
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as ContributionPaymentStatus | '')} className="w-36" aria-label="Status">
              <option value="">All statuses</option>
              <option value="RECORDED">Recorded</option>
              <option value="REVERSED">Reversed</option>
            </NativeSelect>
          </>
        }
        mobileCard={(p) => (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{memberLabel(p.memberName, p.memberNumber)}</p>
              <p className="text-xs text-muted-foreground">{formatDate(p.paidOn)} · {label(p.method)}{p.reference && ` ${p.reference}`}</p>
            </div>
            <div className="shrink-0 text-right">
              <MoneyText value={p.amountMinor} currency={p.currency} className="font-medium" />
              <div className="mt-1"><PaymentStatus p={p} /></div>
            </div>
          </div>
        )}
        {...list.table}
      />
      <PaymentDialog id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

function PaymentDialog({ id, onClose }: { id: string | null; onClose(): void }) {
  const can = useCan();
  const me = useMyUserId();
  const directory = useMemberDirectory();
  const [reversing, setReversing] = useState(false);
  const q = useQuery({ queryKey: ['contributions', 'detail', id], queryFn: () => contributionsApi.get(id!), enabled: !!id });
  const reverse = useApiMutation((reason: string) => contributionsApi.reverse(id!, reason), { invalidate: keys('contribution'), toastErrors: false });
  const p: PaymentView | undefined = q.data;
  const canReverse = !!p && p.status === 'RECORDED' && can('CONTRIBUTION_REVERSE') && p.memberUserId !== me;

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Contribution payment</DialogTitle>
          <DialogDescription>{p ? memberLabel(p.memberName, p.memberNumber) : 'Loading…'}</DialogDescription>
        </DialogHeader>
        {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !p ? <LoadingState /> : (
          <div className="space-y-4">
            <DetailList
              items={[
                { label: 'Amount', value: <MoneyText value={p.amountMinor} currency={p.currency} className="text-lg font-semibold" /> },
                { label: 'Status', value: <StatusChip status={p.status} /> },
                { label: 'Paid on', value: formatDate(p.paidOn) },
                { label: 'Method', value: <>{label(p.method)}{p.reference && <span className="ml-1 font-mono">{p.reference}</span>}</> },
                { label: 'Recorded', value: `${formatInstant(p.recordedAt)} by ${directory.nameOf(p.recordedBy)}` },
                { label: 'Ledger entry', value: <EntryLink id={p.ledgerEntryId} /> },
                p.notes ? { label: 'Notes', value: p.notes } : null,
                p.reversedAt ? { label: 'Reversed', value: `${formatInstant(p.reversedAt)} by ${directory.nameOf(p.reversedBy)}` } : null,
                p.reversalReason ? { label: 'Reversal reason', value: p.reversalReason } : null,
              ]}
            />
            <div>
              <p className="mb-1 text-sm font-medium">Allocated to</p>
              <ul className="divide-y rounded-md border">
                {p.allocations.map((a) => (
                  <li key={a.productId} className="flex justify-between px-3 py-2 text-sm">
                    <span>{a.productName}</span>
                    <MoneyText value={a.amountMinor} currency={p.currency} />
                  </li>
                ))}
              </ul>
            </div>
            {canReverse && (
              <div className="flex justify-end border-t pt-4">
                <Button variant="outline" className="text-destructive" onClick={() => setReversing(true)}><Undo2 />Reverse payment</Button>
              </div>
            )}
            {p.status === 'RECORDED' && can('CONTRIBUTION_REVERSE') && p.memberUserId === me && (
              <p className="border-t pt-4 text-xs text-muted-foreground">This is your own payment; another official must reverse it.</p>
            )}
          </div>
        )}
        {p && (
          <ReasonDialog
            open={reversing}
            onOpenChange={setReversing}
            title="Reverse this payment?"
            description={<>This undoes <MoneyText value={p.amountMinor} currency={p.currency} /> from {memberLabel(p.memberName, p.memberNumber)} in their accounts and in the books. It can&apos;t be undone.</>}
            confirmLabel="Reverse payment"
            onConfirm={(reason) => reverse.mutateAsync(reason)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
