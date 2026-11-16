'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, Check, X } from 'lucide-react';
import { loansApi } from '@/api/endpoints/loans';
import type { GuaranteeView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, MoneyText, PageHeader, StatusChip } from '@/components/shared/Display';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/primitives';
import { isLoanOpen } from '@/features/loans/guaranteeTransfer';
import { TransferGuaranteeDialog } from '@/features/loans/TransferGuaranteeDialog';
import { useApiMutation } from '@/hooks/useApiMutation';
import { useMyUserId } from '@/hooks/useSessionInfo';
import { formatDate, memberLabel } from '@/lib/format';
import { keys } from '@/lib/invalidation';

export default function GuaranteesPage() {
  return (
    <Guard feature="LOANS">
      <Guarantees />
    </Guard>
  );
}

/** README §7.9: loans other members asked this member to guarantee. */
function Guarantees() {
  const q = useQuery({ queryKey: ['loans', 'guarantees'], queryFn: loansApi.guarantees });
  const me = useMyUserId();
  const [answer, setAnswer] = useState<{ g: GuaranteeView; accept: boolean } | null>(null);
  const [moving, setMoving] = useState<GuaranteeView | null>(null);
  const respond = useApiMutation((v: { id: string; accept: boolean }) => loansApi.respondGuarantee(v.id, v.accept), { invalidate: keys('guaranteeTransfer'), toastErrors: false });
  const sorted = [...(q.data ?? [])].sort((a, b) => Number(b.myStatus === 'REQUESTED') - Number(a.myStatus === 'REQUESTED'));

  return (
    <div className="space-y-5">
      <PageHeader title="Guarantee requests" description="Members who asked you to stand surety for their loans." />
      {q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data ? <LoadingState /> : sorted.length === 0 ? (
        <EmptyState title="No guarantee requests" message="When a member names you as a guarantor, the request shows here." />
      ) : (
        <div className="space-y-3">
          {sorted.map((g) => {
            const l = g.loan;
            return (
              <Card key={l.id}>
                <CardContent className="space-y-4 p-4 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{memberLabel(l.borrowerName, l.memberNumber)}</p>
                      <p className="text-sm text-muted-foreground">asked on {formatDate(l.appliedOn)}</p>
                    </div>
                    <StatusChip status={g.myStatus} />
                  </div>
                  <DetailList
                    columns={4}
                    items={[
                      { label: 'Amount', value: <MoneyText value={l.principalMinor} currency={l.currency} className="font-semibold" /> },
                      { label: 'Product', value: l.productName },
                      { label: 'Term', value: `${l.termMonths} months` },
                      { label: 'Loan status', value: <StatusChip status={l.status} /> },
                      { label: 'Purpose', value: l.purpose },
                    ]}
                  />
                  {g.myStatus === 'REQUESTED' && isLoanOpen(l.status) && (
                    <div className="space-y-3 border-t pt-4">
                      {/* Past PENDING_GUARANTORS, an open request can only be to take over another member's guarantee. */}
                      {l.status !== 'PENDING_GUARANTORS' && (
                        <p className="text-sm text-muted-foreground">You&apos;ve been asked to take over another member&apos;s guarantee of this loan. If you accept, they are released and you become the guarantor.</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Button variant="success" onClick={() => setAnswer({ g, accept: true })}><Check />Accept</Button>
                        <Button variant="outline" onClick={() => setAnswer({ g, accept: false })}><X />Decline</Button>
                      </div>
                    </div>
                  )}
                  {g.myStatus === 'ACCEPTED' && isLoanOpen(l.status) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                      <p className="text-sm text-muted-foreground">Leaving the chama, or can&apos;t stand surety any more? Ask another member to take over.</p>
                      <Button variant="outline" onClick={() => setMoving(g)}><ArrowLeftRight />Transfer guarantee</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={!!answer}
        onOpenChange={(o) => !o && setAnswer(null)}
        title={answer?.accept ? 'Guarantee this loan?' : 'Decline this request?'}
        description={answer && (answer.accept ? (
          <>By accepting you stand surety for {memberLabel(answer.g.loan.borrowerName, answer.g.loan.memberNumber)}&apos;s loan of <MoneyText value={answer.g.loan.principalMinor} currency={answer.g.loan.currency} />. If they don&apos;t repay, the chama may recover it from you.</>
        ) : (
          <>{memberLabel(answer.g.loan.borrowerName, answer.g.loan.memberNumber)} will need to find another guarantor.</>
        ))}
        confirmLabel={answer?.accept ? 'Accept' : 'Decline'}
        destructive={answer ? !answer.accept : false}
        onConfirm={() => answer && respond.mutateAsync({ id: answer.g.loan.id, accept: answer.accept })}
      />
      {moving && me && (
        <TransferGuaranteeDialog
          open={!!moving}
          onOpenChange={(o) => !o && setMoving(null)}
          loanId={moving.loan.id}
          guarantorUserId={me}
          guarantorName="you"
          borrowerName={memberLabel(moving.loan.borrowerName, moving.loan.memberNumber)}
          // This view doesn't list the other guarantors; the server refuses one who already guarantees (LOAN_INVALID).
          exclude={[moving.loan.borrowerUserId]}
          mine
        />
      )}
    </div>
  );
}
