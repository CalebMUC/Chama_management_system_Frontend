'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, RotateCcw, Undo2 } from 'lucide-react';
import { submissionsApi } from '@/api/endpoints/submissions';
import type { SubmissionStatus, SubmissionView } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { Can } from '@/components/shared/Can';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/Display';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/features/dashboard/Ranked';
import { MethodAndReference, SubmissionOutcome } from '@/features/submissions/SubmissionParts';
import { REPORT_PAYMENT_PATH, reportAgainHref, whatFor } from '@/features/submissions/submissionLinks';
import { useApiMutation } from '@/hooks/useApiMutation';
import { usePaged } from '@/hooks/usePaged';
import { useCan } from '@/hooks/useSessionInfo';
import { formatDate, formatInstant } from '@/lib/format';
import { keys } from '@/lib/invalidation';

type Filter = 'ALL' | SubmissionStatus;

/** README §7.8a "My reported payments": GET /payment-submissions/me, pending first. */
export default function MyReportedPaymentsPage() {
  const can = useCan();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [withdrawing, setWithdrawing] = useState<SubmissionView | null>(null);
  const list = usePaged(['paymentSubmissions', 'me'], { status: filter === 'ALL' ? undefined : filter }, submissionsApi.mine);
  const cancel = useApiMutation((id: string) => submissionsApi.cancel(id), { invalidate: keys('submission'), toastErrors: false });
  const canReport = can('PAYMENT_SUBMIT');

  const columns = useMemo<ColumnDef<SubmissionView, unknown>[]>(
    () => [
      { id: 'paidOn', header: 'Date paid', cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.paidOn)}</span> },
      { id: 'for', header: 'What for', cell: ({ row }) => <span className="line-clamp-2 min-w-[11rem]">{whatFor(row.original)}</span> },
      { id: 'amount', header: 'Amount', meta: { numeric: true }, cell: ({ row }) => <Amount value={row.original.amountMinor} currency={row.original.currency} /> },
      { id: 'method', header: 'Paid by', cell: ({ row }) => <MethodAndReference s={row.original} /> },
      { id: 'status', header: 'Status', cell: ({ row }) => <SubmissionOutcome s={row.original} /> },
      { id: 'submittedAt', header: 'Reported', cell: ({ row }) => <span className="whitespace-nowrap text-xs text-muted-foreground">{formatInstant(row.original.submittedAt)}</span> },
      { id: 'actions', header: '', cell: ({ row }) => <RowActions s={row.original} canReport={canReport} onWithdraw={setWithdrawing} /> },
    ],
    [canReport],
  );

  return (
    <div className="space-y-3">
      <PageHeader
        title="My reported payments"
        description="Payments you told the treasurer about. Nothing is on your balances until a report is confirmed."
        actions={<Can permission="PAYMENT_SUBMIT"><Button asChild><Link href={REPORT_PAYMENT_PATH}><Plus />Report a payment</Link></Button></Can>}
      />
      <DataTable
        {...list.table}
        columns={columns}
        getRowId={(s) => s.id}
        toolbar={
          <Segmented<Filter>
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'PENDING', label: 'Awaiting confirmation' },
              { value: 'APPROVED', label: 'Confirmed' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: 'CANCELLED', label: 'Withdrawn' },
            ]}
          />
        }
        emptyTitle={filter === 'ALL' ? 'No reported payments yet' : 'None here'}
        emptyMessage={filter === 'ALL' ? 'Paid a contribution, penalty or loan instalment by M-Pesa or at the bank? Report it and the treasurer confirms it.' : undefined}
        emptyAction={filter === 'ALL' && canReport ? <Button asChild size="sm"><Link href={REPORT_PAYMENT_PATH}><Plus />Report a payment</Link></Button> : undefined}
        mobileCard={(s) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{whatFor(s)}</p>
                <p className="text-xs text-muted-foreground">Paid {formatDate(s.paidOn)}</p>
              </div>
              <Amount value={s.amountMinor} currency={s.currency} className="shrink-0 font-semibold" />
            </div>
            <div className="flex items-start justify-between gap-2 text-sm">
              <MethodAndReference s={s} />
              <SubmissionOutcome s={s} />
            </div>
            <RowActions s={s} canReport={canReport} onWithdraw={setWithdrawing} />
          </div>
        )}
      />
      <ConfirmDialog
        open={!!withdrawing}
        onOpenChange={(o) => !o && setWithdrawing(null)}
        title="Withdraw this report?"
        description={withdrawing && <>The treasurer won&apos;t review your report of <Amount value={withdrawing.amountMinor} currency={withdrawing.currency} sensitive={false} /> ({whatFor(withdrawing).toLowerCase()}). You can report it again later.</>}
        confirmLabel="Withdraw report"
        destructive
        onConfirm={() => cancel.mutateAsync(withdrawing!.id)}
      />
    </div>
  );
}

function RowActions({ s, canReport, onWithdraw }: { s: SubmissionView; canReport: boolean; onWithdraw(s: SubmissionView): void }) {
  if (s.status === 'PENDING') {
    return <Button variant="outline" size="sm" onClick={() => onWithdraw(s)}><Undo2 />Withdraw</Button>;
  }
  if (s.status === 'REJECTED' && canReport) {
    return <Button variant="outline" size="sm" asChild><Link href={reportAgainHref(s)}><RotateCcw />Report again</Link></Button>;
  }
  return null;
}
