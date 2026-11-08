'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Check, Undo2, X } from 'lucide-react';
import { expensesApi } from '@/api/endpoints/spending';
import { ApprovalProgress } from '@/components/shared/ApprovalProgress';
import { Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, EntryLink, MoneyText, PageHeader, StatusChip } from '@/components/shared/Display';
import { GatedButton } from '@/components/shared/GatedButton';
import { PaymentDialog } from '@/components/shared/PaymentDialog';
import { ReasonDialog } from '@/components/shared/ReasonDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Card, CardContent } from '@/components/ui/primitives';
import { CashBalances } from '@/features/books/CashBalances';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useMemberDirectory } from '@/hooks/useMembers';
import { useCan, useMyUserId } from '@/hooks/useSessionInfo';
import { formatDate, formatInstant, formatMoney } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { label } from '@/lib/labels';

export default function ExpenseDetailPage() {
  return (
    <Guard permission="EXPENSE_VIEW" feature="EXPENSES">
      <ExpenseDetail />
    </Guard>
  );
}

type Dialog = 'approve' | 'reject' | 'cancel' | 'pay' | null;

/** README §7.10: maker-checker. The recorder can't approve or reject; only the recorder cancels. */
function ExpenseDetail() {
  const { id } = useParams<{ id: string }>();
  const can = useCan();
  const me = useMyUserId();
  const directory = useMemberDirectory();
  const [dialog, setDialog] = useState<Dialog>(null);
  const q = useQuery({ queryKey: ['expenses', 'detail', id], queryFn: () => expensesApi.get(id) });
  const opts = { invalidate: keys('expense'), toastErrors: false };
  const approve = useApiMutation((note: string) => expensesApi.approve(id, note || undefined), opts);
  const reject = useApiMutation((reason: string) => expensesApi.reject(id, reason), opts);
  const cancel = useApiMutation(() => expensesApi.cancel(id), opts);
  const pay = useApiMutation((b: Parameters<typeof expensesApi.pay>[1]) => expensesApi.pay(id, b), opts);

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  const e = q.data;
  const mine = e.requestedBy === me;
  const alreadyApproved = e.approvals.some((a) => a.approverUserId === me);
  const close = (o: boolean) => !o && setDialog(null);
  const amount = <MoneyText value={e.amountMinor} currency={e.currency} className="font-semibold" />;

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: '/expenses', label: 'Expenses' }}
        title={<span className="flex flex-wrap items-center gap-2"><MoneyText value={e.amountMinor} currency={e.currency} /> · {e.payee}<StatusChip status={e.status} /></span>}
        actions={
          <>
            {e.status === 'PENDING_APPROVAL' && can('EXPENSE_APPROVE') && (
              <GatedButton blocked={mine ? 'You recorded this expense, so someone else must approve it.' : alreadyApproved && 'You have already approved this expense.'} onClick={() => setDialog('approve')}><Check />Approve</GatedButton>
            )}
            {(e.status === 'PENDING_APPROVAL' || e.status === 'APPROVED') && can('EXPENSE_APPROVE') && (
              <GatedButton variant="outline" blocked={mine && 'You recorded this expense, so someone else must reject it.'} onClick={() => setDialog('reject')}><X />Reject</GatedButton>
            )}
            {e.status === 'APPROVED' && can('EXPENSE_CREATE') && <GatedButton onClick={() => setDialog('pay')}><Banknote />Pay</GatedButton>}
            {(e.status === 'PENDING_APPROVAL' || e.status === 'APPROVED') && can('EXPENSE_CREATE') && mine && (
              <GatedButton variant="ghost" onClick={() => setDialog('cancel')}><Undo2 />Cancel</GatedButton>
            )}
          </>
        }
      />
      <Card>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <DetailList
            columns={3}
            items={[
              { label: 'Description', value: e.description },
              { label: 'Incurred on', value: formatDate(e.incurredOn) },
              { label: 'Account', value: `${e.accountCode} · ${e.accountName}` },
              e.investmentId ? { label: 'Investment', value: <Link className="text-primary hover:underline" href={`/investments/${e.investmentId}`}>{e.investmentName}</Link> } : null,
              { label: 'Requested by', value: e.requestedByName ?? directory.nameOf(e.requestedBy) },
              e.paidOn ? { label: 'Paid', value: <>{formatDate(e.paidOn)} by {directory.nameOf(e.paidBy)} · {label(e.paymentMethod)}{e.paymentReference && <span className="ml-1 font-mono">{e.paymentReference}</span>}</> } : null,
              e.ledgerEntryId ? { label: 'Ledger entry', value: <EntryLink id={e.ledgerEntryId} /> } : null,
              e.rejectionReason ? { label: 'Rejected', value: `${e.rejectedAt ? formatInstant(e.rejectedAt) : ''} by ${directory.nameOf(e.rejectedBy)}: ${e.rejectionReason}` } : null,
              e.cancelledAt ? { label: 'Cancelled', value: formatInstant(e.cancelledAt) } : null,
            ]}
          />
          {e.status !== 'CANCELLED' && (e.status !== 'REJECTED' || e.approvals.length > 0) && (
            <div className="max-w-md"><ApprovalProgress approvals={e.approvals} required={e.requiredApprovals} /></div>
          )}
        </CardContent>
      </Card>

      <ReasonDialog open={dialog === 'approve'} onOpenChange={close} title="Approve this expense?" description={<>{amount} to {e.payee}. Approvals so far: {e.approvals.length} of {e.requiredApprovals}.</>} confirmLabel="Approve" destructive={false} optional onConfirm={(n) => approve.mutateAsync(n)} />
      <ReasonDialog open={dialog === 'reject'} onOpenChange={close} title="Reject this expense?" description={<>{amount} to {e.payee} will not be paid.</>} confirmLabel="Reject" onConfirm={(r) => reject.mutateAsync(r)} />
      <ConfirmDialog open={dialog === 'cancel'} onOpenChange={close} title="Cancel this expense?" description={<>Withdraw your request to pay {amount} to {e.payee}.</>} confirmLabel="Cancel expense" destructive onConfirm={() => cancel.mutateAsync(undefined)} />
      <PaymentDialog
        open={dialog === 'pay'}
        onOpenChange={close}
        title="Pay this expense"
        description={<>Pay {amount} to {e.payee}.</>}
        summary={<CashBalances />}
        dateField="paidOn"
        dateLabel="Date paid"
        submitLabel={`Pay ${formatMoney(e.amountMinor, e.currency)}`}
        onSubmit={(v) => pay.mutateAsync({ method: v.method, reference: v.reference, paidOn: v.date })}
      />
    </div>
  );
}
