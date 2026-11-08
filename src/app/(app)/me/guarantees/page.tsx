'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { loansApi } from '@/api/endpoints/loans';
import type { GuaranteeView } from '@/api/types';
import { Guard } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DetailList, MoneyText, PageHeader, StatusChip } from '@/components/shared/Display';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/primitives';
import { useApiMutation } from '@/hooks/useApiMutation';
import { formatDate, memberLabel } from '@/lib/format';

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
  const [answer, setAnswer] = useState<{ g: GuaranteeView; accept: boolean } | null>(null);
  const respond = useApiMutation((v: { id: string; accept: boolean }) => loansApi.respondGuarantee(v.id, v.accept), { invalidate: ['loans', 'dashboard'], toastErrors: false });
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
                  {g.myStatus === 'REQUESTED' && l.status === 'PENDING_GUARANTORS' && (
                    <div className="flex flex-wrap gap-2 border-t pt-4">
                      <Button variant="success" onClick={() => setAnswer({ g, accept: true })}><Check />Accept</Button>
                      <Button variant="outline" onClick={() => setAnswer({ g, accept: false })}><X />Decline</Button>
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
    </div>
  );
}
