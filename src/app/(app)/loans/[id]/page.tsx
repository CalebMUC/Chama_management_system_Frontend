'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Check, HandCoins, X } from 'lucide-react';
import { loansApi } from '@/api/endpoints/loans';
import type { LoanDetailView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { MoneyText, PageHeader } from '@/components/shared/Display';
import { PaymentDialog } from '@/components/shared/PaymentDialog';
import { ReasonDialog } from '@/components/shared/ReasonDialog';
import { ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/overlays';
import { Card, CardContent } from '@/components/ui/primitives';
import { CashBalances } from '@/features/books/CashBalances';
import { LoanDetailBody, LoanFigures, LoanStatusLine, RepaidProgress } from '@/features/loans/LoanPanels';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useCan, useMyUserId } from '@/hooks/useSessionInfo';
import { formatMoney, memberLabel } from '@/lib/format';
import { keys } from '@/lib/invalidation';

export default function LoanDetailPage() {
  return (
    <Guard permission="LOAN_VIEW_ALL" feature="LOANS">
      <LoanDetail />
    </Guard>
  );
}

type Dialog = 'approve' | 'reject' | 'disburse' | 'repay' | null;

/** README §7.9: loan detail with the officials' actions and the §8.1 self-handling rules. */
function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['loans', 'detail', id], queryFn: () => loansApi.get(id) });
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingState />;
  return <LoanView detail={q.data} />;
}

function LoanView({ detail }: { detail: LoanDetailView }) {
  const { loan } = detail;
  const can = useCan();
  const me = useMyUserId();
  const [dialog, setDialog] = useState<Dialog>(null);
  const opts = { invalidate: keys('loanOfficial'), toastErrors: false };
  const approve = useApiMutation((note: string) => loansApi.approve(loan.id, note || undefined), opts);
  const reject = useApiMutation((reason: string) => loansApi.reject(loan.id, reason), opts);
  const disburse = useApiMutation((b: Parameters<typeof loansApi.disburse>[1]) => loansApi.disburse(loan.id, b), opts);
  const repay = useApiMutation((b: Parameters<typeof loansApi.repay>[1]) => loansApi.repay(loan.id, b), opts);

  const borrower = loan.borrowerUserId === me;
  const guarantor = detail.guarantors.some((g) => g.userId === me && g.status !== 'DECLINED' && g.status !== 'WITHDRAWN');
  const approved = detail.approvals.some((a) => a.approverUserId === me);
  const name = memberLabel(loan.borrowerName, loan.memberNumber);
  const c = loan.currency;

  /** An action button, disabled with the reason when a §8.1 rule blocks the user. */
  const action = (show: boolean, blocked: string | null, el: ReactNode) => {
    if (!show) return null;
    if (!blocked) return el;
    return <Tooltip content={blocked}><span className="inline-flex [&>button]:pointer-events-none">{el}</span></Tooltip>;
  };
  const ownLoan = borrower ? 'This is your own loan; another official must handle it.' : null;
  const approveBlock = ownLoan ?? (guarantor ? "You're a guarantor on this loan, so you can't approve it." : approved ? 'You have already approved this loan.' : null);

  // "+ New › Record loan repayment" lands here with ?action=repay: open the same dialog the button opens, under the same rules.
  const router = useRouter();
  const params = useSearchParams();
  const canRepay = loan.status === 'ACTIVE' && can('LOAN_REPAYMENT_RECORD') && !ownLoan;
  useEffect(() => {
    if (params.get('action') !== 'repay') return;
    if (canRepay) setDialog('repay');
    router.replace(`/loans/${loan.id}`, { scroll: false });
  }, [params, canRepay, loan.id, router]);

  return (
    <div className="space-y-5">
      <PageHeader
        back={{ href: '/loans', label: 'Loans' }}
        title={<><MoneyText value={loan.principalMinor} currency={c} /> · {name}</>}
        description={<LoanStatusLine loan={loan} />}
        actions={
          <>
            {action(loan.status === 'PENDING_APPROVAL' && can('LOAN_APPROVE'), approveBlock, <Button onClick={() => setDialog('approve')} disabled={!!approveBlock}><Check />Approve</Button>)}
            {action(['PENDING_GUARANTORS', 'PENDING_APPROVAL', 'APPROVED'].includes(loan.status) && can('LOAN_APPROVE'), ownLoan, <Button variant="outline" onClick={() => setDialog('reject')} disabled={!!ownLoan}><X />Reject</Button>)}
            {action(loan.status === 'APPROVED' && can('LOAN_DISBURSE'), ownLoan, <Button onClick={() => setDialog('disburse')} disabled={!!ownLoan}><Banknote />Disburse</Button>)}
            {action(loan.status === 'ACTIVE' && can('LOAN_REPAYMENT_RECORD'), ownLoan, <Button onClick={() => setDialog('repay')} disabled={!!ownLoan}><HandCoins />Record repayment</Button>)}
          </>
        }
      />
      <Card>
        <CardContent className="space-y-5 p-4 sm:p-6">
          <RepaidProgress loan={loan} />
          <LoanFigures loan={loan} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 sm:p-6"><LoanDetailBody detail={detail} linkEntries={can('LEDGER_VIEW')} /></CardContent>
      </Card>

      <ReasonDialog
        open={dialog === 'approve'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Approve this loan?"
        description={<>{name} · <MoneyText value={loan.principalMinor} currency={c} /> over {loan.termMonths} months. Approvals so far: {loan.approvals} of {loan.requiredApprovals}.</>}
        confirmLabel="Approve"
        destructive={false}
        optional
        onConfirm={(note) => approve.mutateAsync(note)}
      />
      <ReasonDialog
        open={dialog === 'reject'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Reject this loan?"
        description={<>{name}&apos;s application for <MoneyText value={loan.principalMinor} currency={c} /> is closed. They see your reason.</>}
        confirmLabel="Reject loan"
        onConfirm={(reason) => reject.mutateAsync(reason)}
      />
      <PaymentDialog
        open={dialog === 'disburse'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Disburse this loan"
        description={<>Pay <MoneyText value={loan.principalMinor} currency={c} className="font-semibold" /> to {name}. The repayment schedule starts from the disbursement date.</>}
        summary={<CashBalances />}
        dateField="disbursedOn"
        dateLabel="Date paid out"
        submitLabel={`Disburse ${formatMoney(loan.principalMinor, c)}`}
        onSubmit={(v) => disburse.mutateAsync({ method: v.method, reference: v.reference, disbursedOn: v.date })}
      />
      <PaymentDialog
        open={dialog === 'repay'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Record a repayment"
        description={name}
        amount={{ max: loan.outstandingMinor, hint: <>Outstanding {formatMoney(loan.outstandingMinor, c)}{loan.nextDueDate && <> · next instalment {formatMoney(loan.nextDueMinor, c)}</>}</>, defaultMinor: loan.nextDueMinor || undefined }}
        dateField="paidOn"
        dateLabel="Date paid"
        submitLabel="Record repayment"
        onSubmit={(v) => repay.mutateAsync({ amountMinor: v.amountMinor!, method: v.method, reference: v.reference, paidOn: v.date })}
      />
    </div>
  );
}
