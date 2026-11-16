'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Check, Undo2, X } from 'lucide-react';
import { exitsApi } from '@/api/endpoints/exits';
import { ApiError, normaliseError } from '@/api/errors';
import type { ExitSettleRequest } from '@/api/types';
import { ApprovalProgress } from '@/components/shared/ApprovalProgress';
import { Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, EntryLink, MoneyText, PageHeader } from '@/components/shared/Display';
import { GatedButton } from '@/components/shared/GatedButton';
import { Identifier } from '@/components/shared/Identifier';
import { Panel } from '@/components/shared/Panel';
import { PaymentDialog } from '@/components/shared/PaymentDialog';
import { ReasonDialog } from '@/components/shared/ReasonDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { CashBalances } from '@/features/books/CashBalances';
import { exitActions, settleErrorMessage } from '@/features/exits/exitRules';
import { ExitStatusChip, SettlementStatement } from '@/features/exits/SettlementStatement';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useMemberDirectory } from '@/hooks/useMembers';
import { useCan, useMyUserId } from '@/hooks/useSessionInfo';
import { formatDate, formatInstant, formatMoney, instantToNairobiDate, memberLabel } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { label } from '@/lib/labels';

export default function MemberExitDetailPage() {
  return (
    <Guard permission="MEMBER_VIEW">
      <ExitDetail />
    </Guard>
  );
}

type Dialog = 'approve' | 'reject' | 'cancel' | 'settle' | null;

/** Rethrow a payout failure with a plain explanation; the dialog shows it and stays open. */
async function explained<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    const err = normaliseError(e);
    throw new ApiError(err.status, err.code, settleErrorMessage(err.code, err.message), err.fields);
  }
}

/** §3a exit detail: the settlement, the approval trail and the maker-checker actions. */
function ExitDetail() {
  const { exitId } = useParams<{ exitId: string }>();
  const can = useCan();
  const me = useMyUserId();
  const directory = useMemberDirectory();
  const [dialog, setDialog] = useState<Dialog>(null);
  const q = useQuery({ queryKey: ['memberExits', 'detail', exitId], queryFn: () => exitsApi.get(exitId) });
  const opts = { invalidate: keys('memberExit'), toastErrors: false };
  const approve = useApiMutation((note: string) => exitsApi.approve(exitId, note || undefined), opts);
  const reject = useApiMutation((reason: string) => exitsApi.reject(exitId, reason), opts);
  const cancel = useApiMutation(() => exitsApi.cancel(exitId), opts);
  const settle = useApiMutation((b: ExitSettleRequest) => exitsApi.settle(exitId, b), { invalidate: keys('memberExitSettle'), toastErrors: false });
  const requestedOn = q.data ? instantToNairobiDate(q.data.requestedAt) : null;
  const minDate = useMemo(() => (requestedOn ? { value: requestedOn, message: 'Cannot be before the exit was started' } : undefined), [requestedOn]);

  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  const e = q.data;
  const s = e.settlement;
  const actions = exitActions(e, me, can);
  const name = memberLabel(e.memberName, e.memberNumber);
  const close = (o: boolean) => !o && setDialog(null);
  const payout = <MoneyText value={s.payoutMinor} currency={s.currency} className="font-semibold" />;

  return (
    <div className="space-y-3">
      <PageHeader
        back={{ href: '/members/exits', label: 'Member exits' }}
        title={<span className="flex flex-wrap items-center gap-2">{name} · leaving<ExitStatusChip status={e.status} /></span>}
        description={<>Started {formatInstant(e.requestedAt)}{e.requestedByName && ` by ${e.requestedByName}`} · payout {formatMoney(s.payoutMinor, s.currency)}</>}
        actions={
          <>
            {actions.approve.show && <GatedButton blocked={actions.approve.blocked} onClick={() => setDialog('approve')}><Check />Approve</GatedButton>}
            {actions.reject.show && <GatedButton variant="outline" blocked={actions.reject.blocked} onClick={() => setDialog('reject')}><X />Reject</GatedButton>}
            {actions.settle.show && <GatedButton blocked={actions.settle.blocked} onClick={() => setDialog('settle')}><Banknote />Pay out</GatedButton>}
            {actions.cancel && <GatedButton variant="ghost" onClick={() => setDialog('cancel')}><Undo2 />Cancel exit</GatedButton>}
          </>
        }
      />

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(18rem,2fr)]">
        <Panel title="Settlement" description={e.status === 'SETTLED' ? 'As paid out.' : 'As worked out when the exit was started. At payout it must still be exactly this.'}>
          <SettlementStatement settlement={s} />
        </Panel>

        <div className="space-y-3">
          <Panel title="Details">
            <DetailList
              columns={1}
              items={[
                { label: 'Member', value: <Link href={`/members/${e.memberUserId}`} className="font-medium text-primary hover:underline">{name}</Link> },
                { label: 'Reason', value: e.reason },
                { label: 'Started', value: <>{formatInstant(e.requestedAt)} by {e.requestedByName ?? directory.nameOf(e.requestedBy)}</> },
                e.rejectedAt ? { label: 'Rejected', value: <>{formatInstant(e.rejectedAt)} by {directory.nameOf(e.rejectedBy)}{e.rejectionReason && <span className="block text-muted-foreground">“{e.rejectionReason}”</span>}</> } : null,
                e.cancelledAt ? { label: 'Cancelled', value: formatInstant(e.cancelledAt) } : null,
                e.settledOn ? { label: 'Paid out', value: <>{formatDate(e.settledOn)}{e.settledBy && ` by ${directory.nameOf(e.settledBy)}`}</> } : null,
                e.status === 'SETTLED' && s.payoutMinor > 0 ? { label: 'Method', value: <>{label(e.paymentMethod)}{e.paymentReference && <> · <Identifier value={e.paymentReference} /></>}</> } : null,
                e.status === 'SETTLED' && s.payoutMinor === 0 ? { label: 'Method', value: 'Nothing to pay out' } : null,
                e.settlementEntryId && can('LEDGER_VIEW') ? { label: 'Ledger entry', value: <EntryLink id={e.settlementEntryId} /> } : null,
              ]}
            />
          </Panel>
          {e.status !== 'CANCELLED' && (e.status !== 'REJECTED' || e.approvals.length > 0) && (
            <Panel title="Approvals">
              <ApprovalProgress approvals={e.approvals} required={e.requiredApprovals} />
            </Panel>
          )}
        </div>
      </div>

      <ReasonDialog
        open={dialog === 'approve'}
        onOpenChange={close}
        title="Approve this exit?"
        description={<>{name} leaves with a payout of {payout}. Approvals so far: {e.approvals.length} of {e.requiredApprovals}.</>}
        confirmLabel="Approve"
        destructive={false}
        optional
        onConfirm={(note) => approve.mutateAsync(note)}
      />
      <ReasonDialog
        open={dialog === 'reject'}
        onOpenChange={close}
        title="Reject this exit?"
        description={<>{name} stays a member and nothing is paid out. A new exit can be started later.</>}
        confirmLabel="Reject exit"
        onConfirm={(reason) => reject.mutateAsync(reason)}
      />
      <ConfirmDialog
        open={dialog === 'cancel'}
        onOpenChange={close}
        title="Cancel this exit?"
        description={<>Withdraw the exit you started for {name}. They stay a member and nothing is paid out.</>}
        confirmLabel="Cancel exit"
        destructive
        onConfirm={() => cancel.mutateAsync(undefined)}
      />
      {s.payoutMinor > 0 ? (
        <PaymentDialog
          open={dialog === 'settle'}
          onOpenChange={close}
          title="Pay out this exit"
          description={<>Pay {payout} to {name}. This clears their loans and penalties from their savings, keeps their non-refundable savings for the chama, closes all their accounts and ends their membership permanently.</>}
          summary={<CashBalances />}
          dateField="settledOn"
          dateLabel="Date paid"
          minDate={minDate}
          submitLabel={`Pay out ${formatMoney(s.payoutMinor, s.currency)}`}
          destructive
          onSubmit={(v) => explained(settle.mutateAsync({ method: v.method, reference: v.reference, settledOn: v.date }))}
        />
      ) : (
        <ConfirmDialog
          open={dialog === 'settle'}
          onOpenChange={close}
          title={`Settle ${name}'s exit?`}
          description={
            <>
              There is nothing to pay out{s.loansMinor + s.penaltiesMinor > 0 && ': their savings clear what they owe'}. This will close all the member&apos;s
              accounts and end their membership permanently.
            </>
          }
          confirmLabel="Settle and close accounts"
          destructive
          onConfirm={() => explained(settle.mutateAsync({}))}
        />
      )}
    </div>
  );
}
