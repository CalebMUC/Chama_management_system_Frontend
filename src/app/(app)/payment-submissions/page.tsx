'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { submissionsApi } from '@/api/endpoints/submissions';
import type { SubmissionKind, SubmissionView } from '@/api/types';
import { Amount } from '@/components/shared/Amount';
import { Guard } from '@/components/shared/Can';
import { DataTable, type ColumnDef } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/Display';
import { KeyValue } from '@/components/shared/Panel';
import { MemberPicker } from '@/components/shared/MemberPicker';
import { ReasonDialog } from '@/components/shared/ReasonDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/overlays';
import { NativeSelect } from '@/components/ui/primitives';
import { REVIEW_PERMISSIONS } from '@/config/navigation';
import { MethodAndReference, SubmissionOutcome } from '@/features/submissions/SubmissionParts';
import { whatFor } from '@/features/submissions/submissionLinks';
import { useApiMutation } from '@/hooks/useApiMutation';
import { usePaged } from '@/hooks/usePaged';
import { useCan, useMyUserId } from '@/hooks/useSessionInfo';
import { formatDate, formatInstant, memberLabel } from '@/lib/format';
import { keys } from '@/lib/invalidation';
import { label } from '@/lib/labels';

export default function PaymentsToConfirmPage() {
  return (
    <Guard permission={REVIEW_PERMISSIONS}>
      <PaymentsToConfirm />
    </Guard>
  );
}

const KIND_LABEL: Record<SubmissionKind, string> = { CONTRIBUTION: 'Contributions', PENALTY_PAYMENT: 'Penalty payments', LOAN_REPAYMENT: 'Loan repayments' };
const RECORDED_AS: Record<SubmissionKind, string> = { CONTRIBUTION: 'a contribution', PENALTY_PAYMENT: 'a penalty payment', LOAN_REPAYMENT: 'a loan repayment' };

/**
 * README §7.8a "Payments to confirm": members' reports of payments they made, for the kinds this user may record. Confirming
 * records the real payment in the books under the reviewer's name; rejecting needs a reason, which the member is emailed.
 */
function PaymentsToConfirm() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const qc = useQueryClient();
  const can = useCan();
  const me = useMyUserId();
  // Pending is the working view; "All" shows what was decided.
  const tab = params.get('status') === 'ALL' ? 'ALL' : 'PENDING';
  const [kind, setKind] = useState<SubmissionKind | ''>('');
  const [member, setMember] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<SubmissionView | null>(null);
  const [rejecting, setRejecting] = useState<SubmissionView | null>(null);

  const kinds = useQuery({ queryKey: ['paymentSubmissions', 'reviewableKinds'], queryFn: submissionsApi.reviewableKinds, staleTime: 5 * 60_000 });
  const list = usePaged(['paymentSubmissions', 'queue'], { status: tab === 'PENDING' ? ('PENDING' as const) : undefined, kind: kind || undefined, memberUserId: member ?? undefined }, submissionsApi.list);

  // Confirming records the real payment: refresh everything it touches. On an error (e.g. the penalty was paid down meanwhile),
  // refetch the queue so the row shows its current state, and keep the dialog open with the message.
  const refreshQueue = () => qc.invalidateQueries({ queryKey: ['paymentSubmissions'] });
  const approve = useApiMutation((v: { id: string; note?: string }) => submissionsApi.approve(v.id, v.note), { invalidate: keys('submissionReview'), toastErrors: false });
  const reject = useApiMutation((v: { id: string; reason: string }) => submissionsApi.reject(v.id, v.reason), { invalidate: keys('submission'), toastErrors: false });

  const columns = useMemo<ColumnDef<SubmissionView, unknown>[]>(
    () => [
      { id: 'submittedAt', header: 'Reported', cell: ({ row }) => <span className="whitespace-nowrap text-xs">{formatInstant(row.original.submittedAt)}</span> },
      { id: 'member', header: 'Member', cell: ({ row }) => <span className="whitespace-nowrap font-medium">{memberLabel(row.original.memberName, row.original.memberNumber)}</span> },
      { id: 'for', header: 'What for', cell: ({ row }) => <span className="line-clamp-2 min-w-[10rem]">{whatFor(row.original)}</span> },
      { id: 'amount', header: 'Amount', meta: { numeric: true }, cell: ({ row }) => <Amount value={row.original.amountMinor} currency={row.original.currency} sensitive={false} className="font-medium" /> },
      { id: 'method', header: 'Paid by', cell: ({ row }) => <MethodAndReference s={row.original} /> },
      { id: 'paidOn', header: 'Date paid', cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.paidOn)}</span> },
      { id: 'notes', header: 'Notes', cell: ({ row }) => (row.original.notes ? <span className="line-clamp-2 max-w-[14rem] text-xs">{row.original.notes}</span> : <span className="text-muted-foreground">—</span>) },
      ...(tab === 'ALL' ? [{ id: 'status', header: 'Status', cell: ({ row }) => <SubmissionOutcome s={row.original} /> } as ColumnDef<SubmissionView, unknown>] : []),
      { id: 'actions', header: '', cell: ({ row }) => <ReviewActions s={row.original} me={me} onConfirm={setConfirming} onReject={setRejecting} /> },
    ],
    [tab, me],
  );

  const reviewable = kinds.data ?? [];
  return (
    <div className="space-y-3">
      <PageHeader
        title="Payments to confirm"
        description="Members report payments they made. Check each against the M-Pesa or bank statement, then confirm it to record it, or reject it with a reason."
      />
      <Tabs value={tab} onValueChange={(v) => router.replace(v === 'PENDING' ? pathname : `${pathname}?status=ALL`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="PENDING">To confirm</TabsTrigger>
          <TabsTrigger value="ALL">All reports</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        {...list.table}
        columns={columns}
        getRowId={(s) => s.id}
        toolbar={
          <>
            {reviewable.length > 1 && (
              <NativeSelect className="w-full sm:w-48" value={kind} onChange={(e) => setKind(e.target.value as SubmissionKind | '')} aria-label="Kind">
                <option value="">All kinds</option>
                {reviewable.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
              </NativeSelect>
            )}
            {can('MEMBER_VIEW') && (
              <div className="w-full sm:w-60"><MemberPicker value={member} onChange={(id) => setMember(id)} statuses={['ACTIVE', 'SUSPENDED', 'EXITED']} placeholder="All members" /></div>
            )}
            {member && <Button variant="ghost" size="sm" onClick={() => setMember(null)}>Clear member</Button>}
          </>
        }
        emptyTitle={tab === 'PENDING' ? 'Nothing to confirm' : 'No reports yet'}
        emptyMessage={tab === 'PENDING' ? 'When members report a payment they made, it waits here for you to check.' : undefined}
        mobileCard={(s) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{memberLabel(s.memberName, s.memberNumber)}</p>
                <p className="text-xs text-muted-foreground">{whatFor(s)} · paid {formatDate(s.paidOn)}</p>
              </div>
              <Amount value={s.amountMinor} currency={s.currency} sensitive={false} className="shrink-0 font-semibold" />
            </div>
            <div className="flex items-start justify-between gap-2 text-sm">
              <MethodAndReference s={s} />
              {tab === 'ALL' && <SubmissionOutcome s={s} />}
            </div>
            {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}
            <ReviewActions s={s} me={me} onConfirm={setConfirming} onReject={setRejecting} />
          </div>
        )}
      />

      <ReasonDialog
        open={!!confirming}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="Confirm this payment?"
        description={confirming && <>This records {RECORDED_AS[confirming.kind]} for {memberLabel(confirming.memberName, confirming.memberNumber)} in the books, under your name, exactly as if you had recorded it yourself. Check it against the statement first.</>}
        confirmLabel="Confirm and record"
        destructive={false}
        optional
        fieldLabel="Note for the record (optional)"
        onConfirm={async (note) => {
          try {
            await approve.mutateAsync({ id: confirming!.id, note: note || undefined });
          } catch (e) {
            void refreshQueue();
            throw e;
          }
        }}
      >
        {confirming && <SubmissionSummary s={confirming} />}
      </ReasonDialog>
      <ReasonDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject this report?"
        description="Nothing is recorded. The member is emailed your reason and can report it again."
        confirmLabel="Reject report"
        fieldLabel="Reason (sent to the member)"
        onConfirm={async (reason) => {
          try {
            await reject.mutateAsync({ id: rejecting!.id, reason });
          } catch (e) {
            void refreshQueue();
            throw e;
          }
        }}
      >
        {rejecting && <SubmissionSummary s={rejecting} />}
      </ReasonDialog>
    </div>
  );
}

/** Confirm / Reject on pending reports; nobody reviews their own. */
function ReviewActions({ s, me, onConfirm, onReject }: { s: SubmissionView; me: string | null; onConfirm(s: SubmissionView): void; onReject(s: SubmissionView): void }) {
  if (s.status !== 'PENDING') return null;
  if (s.memberUserId === me) return <span className="text-xs text-muted-foreground">Your own report: another official must confirm it.</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      <Button size="sm" onClick={() => onConfirm(s)}><Check />Confirm</Button>
      <Button size="sm" variant="outline" className="text-destructive" onClick={() => onReject(s)}><X />Reject</Button>
    </span>
  );
}

function SubmissionSummary({ s }: { s: SubmissionView }) {
  return (
    <div className="rounded-md border">
      <KeyValue
        className="px-3"
        items={[
          { label: 'Member', value: memberLabel(s.memberName, s.memberNumber) },
          { label: 'For', value: whatFor(s) },
          { label: 'Amount', value: <Amount value={s.amountMinor} currency={s.currency} sensitive={false} className="font-semibold" />, emphasis: true },
          { label: 'Channel', value: label(s.method) },
          { label: s.method === 'MPESA' ? 'M-Pesa code' : s.method === 'BANK' ? 'Bank slip' : 'Reference', value: s.reference ?? '—' },
          { label: 'Date paid', value: formatDate(s.paidOn) },
          s.notes ? { label: 'Member’s note', value: s.notes } : null,
        ]}
      />
    </div>
  );
}
