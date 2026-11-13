'use client';

import type { SubmissionStatus, SubmissionView } from '@/api/types';
import { StatusChip } from '@/components/shared/Display';
import { Identifier } from '@/components/shared/Identifier';
import { formatInstant } from '@/lib/format';
import { label } from '@/lib/labels';
import { SUBMISSION_STATUS_TEXT } from './submissionLinks';

/** Pending amber ("Awaiting confirmation"), approved green, rejected red, withdrawn grey. */
export function SubmissionStatusChip({ status }: { status: SubmissionStatus }) {
  return <StatusChip status={status} text={SUBMISSION_STATUS_TEXT[status]} />;
}

/** The status with what happened: the rejection reason, or who confirmed it and when. */
export function SubmissionOutcome({ s, showReviewer = true }: { s: SubmissionView; showReviewer?: boolean }) {
  return (
    <div className="space-y-0.5">
      <SubmissionStatusChip status={s.status} />
      {s.status === 'REJECTED' && s.reviewNote && <p className="max-w-[16rem] text-xs text-destructive">{s.reviewNote}</p>}
      {s.status === 'APPROVED' && showReviewer && (
        <p className="text-xs text-muted-foreground">
          {s.reviewerName ? `By ${s.reviewerName}` : 'Confirmed'}{s.reviewedAt ? ` · ${formatInstant(s.reviewedAt)}` : ''}
          {s.reviewNote && <span className="block">{s.reviewNote}</span>}
        </p>
      )}
      {s.status === 'CANCELLED' && s.cancelledAt && <p className="text-xs text-muted-foreground">{formatInstant(s.cancelledAt)}</p>}
    </div>
  );
}

/** "M-Pesa · QK7H2XY9ZB". */
export function MethodAndReference({ s }: { s: Pick<SubmissionView, 'method' | 'reference'> }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span>{label(s.method)}</span>
      {s.reference ? <Identifier value={s.reference} label={s.method === 'MPESA' ? 'M-Pesa code' : 'reference'} /> : <span className="text-xs text-muted-foreground">No reference</span>}
    </span>
  );
}
