'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, HandCoins, Plus, Send, UserPlus, XCircle } from 'lucide-react';
import { loansApi } from '@/api/endpoints/loans';
import type { LoanDetailView } from '@/api/types';
import { Can, Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { MoneyText, PageHeader, StatCard } from '@/components/shared/Display';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Card, CardContent, Label } from '@/components/ui/primitives';
import { GuarantorPicker } from '@/features/loans/GuarantorPicker';
import { reportPaymentHref } from '@/features/submissions/submissionLinks';
import { CANCELLABLE, LoanDetailBody, LoanFigures, LoanStatusLine, RepaidProgress } from '@/features/loans/LoanPanels';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useMyUserId } from '@/hooks/useSessionInfo';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

const LOAN_INVALIDATE = ['loans', 'dashboard'];

export default function MyLoansPage() {
  return (
    <Guard feature="LOANS">
      <MyLoans />
    </Guard>
  );
}

function MyLoans() {
  const q = useQuery({ queryKey: ['loans', 'me'], queryFn: loansApi.mine });
  return (
    <div className="space-y-5">
      <PageHeader
        title="My loans"
        actions={<Can permission="LOAN_APPLY"><Button asChild><Link href="/me/loans/apply"><Plus />Apply for a loan</Link></Button></Can>}
      />
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? <LoadingState /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <StatCard label="Outstanding" value={<MoneyText value={q.data.outstandingMinor} currency={q.data.currency} />} icon={<HandCoins />} />
            <StatCard label="Arrears" value={<MoneyText value={q.data.arrearsMinor} currency={q.data.currency} />} icon={<HandCoins />} tone={q.data.arrearsMinor > 0 ? 'destructive' : 'success'} />
          </div>
          {q.data.loans.length === 0 ? (
            <EmptyState title="No loans yet" message="When you apply, your application and its progress show here." />
          ) : (
            <div className="space-y-3">{q.data.loans.map((d, i) => <LoanCard key={d.loan.id} detail={d} defaultOpen={i === 0} />)}</div>
          )}
        </>
      )}
    </div>
  );
}

function LoanCard({ detail, defaultOpen }: { detail: LoanDetailView; defaultOpen: boolean }) {
  const { loan } = detail;
  const me = useMyUserId();
  const [open, setOpen] = useState(defaultOpen);
  const [cancelling, setCancelling] = useState(false);
  const [adding, setAdding] = useState(false);
  const [guarantor, setGuarantor] = useState<string | null>(null);
  const cancel = useApiMutation(() => loansApi.cancel(loan.id), { invalidate: LOAN_INVALIDATE, toastErrors: false });
  const add = useApiMutation((userId: string) => loansApi.addGuarantor(loan.id, userId), { invalidate: LOAN_INVALIDATE, toastErrors: false });
  const existing = detail.guarantors.filter((g) => g.status !== 'WITHDRAWN' && g.status !== 'DECLINED').map((g) => g.userId);

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold">
              <MoneyText value={loan.principalMinor} currency={loan.currency} /> · {loan.productName}
            </p>
            <p className="text-xs text-muted-foreground">Applied {formatDate(loan.appliedOn)} · {loan.termMonths} months</p>
            <LoanStatusLine loan={loan} />
          </div>
          <ChevronDown className={cn('size-5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        <RepaidProgress loan={loan} />
        {open && (
          <div className="space-y-5 border-t pt-4">
            <LoanFigures loan={loan} />
            <LoanDetailBody detail={detail} />
            {loan.borrowerUserId === me && (
              <div className="flex flex-wrap gap-2 border-t pt-4">
                {loan.status === 'ACTIVE' && (
                  <Can permission="PAYMENT_SUBMIT">
                    <Button variant="outline" asChild><Link href={reportPaymentHref({ kind: 'LOAN_REPAYMENT', targetId: loan.id })}><Send />Report a repayment I made</Link></Button>
                  </Can>
                )}
                {loan.status === 'PENDING_GUARANTORS' && <Button variant="outline" onClick={() => { setGuarantor(null); setAdding(true); }}><UserPlus />Add guarantor</Button>}
                {CANCELLABLE.includes(loan.status) && <Button variant="outline" className="text-destructive" onClick={() => setCancelling(true)}><XCircle />Cancel application</Button>}
              </div>
            )}
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title="Cancel this loan application?"
        description={<>Your application for <MoneyText value={loan.principalMinor} currency={loan.currency} /> will be withdrawn. You can apply again later.</>}
        confirmLabel="Cancel application"
        destructive
        onConfirm={() => cancel.mutateAsync(undefined)}
      />
      <ConfirmDialog
        open={adding}
        onOpenChange={setAdding}
        title="Add a guarantor"
        description="They are asked to stand surety for this loan and can accept or decline."
        confirmLabel="Send request"
        onConfirm={() => {
          if (!guarantor) throw new Error('Choose a member.');
          return add.mutateAsync(guarantor);
        }}
      >
        <div className="space-y-1.5">
          <Label>Member</Label>
          <GuarantorPicker value={guarantor} onChange={(id) => setGuarantor(id)} exclude={existing} />
        </div>
      </ConfirmDialog>
    </Card>
  );
}
