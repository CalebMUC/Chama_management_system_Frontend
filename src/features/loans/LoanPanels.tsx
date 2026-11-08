'use client';

import type { LoanDetailView, LoanView } from '@/api/types';
import { ApprovalProgress } from '@/components/shared/ApprovalProgress';
import { DetailList, EntryLink, MoneyText, Progress, StatusChip } from '@/components/shared/Display';
import { EmptyState } from '@/components/shared/States';
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/primitives';
import { formatBp, formatDate, formatInstant, memberLabel } from '@/lib/format';
import { label } from '@/lib/labels';

export const LOAN_STATUSES = ['PENDING_GUARANTORS', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REPAID', 'REJECTED', 'CANCELLED'] as const;
/** Borrowers can cancel any time before disbursement. */
export const CANCELLABLE = ['PENDING_GUARANTORS', 'PENDING_APPROVAL', 'APPROVED'];

export function RepaidProgress({ loan }: { loan: LoanView }) {
  if (loan.status !== 'ACTIVE' && loan.status !== 'REPAID') return null;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Repaid <MoneyText value={loan.repaidMinor} currency={loan.currency} /></span>
        <span>of <MoneyText value={loan.totalDueMinor} currency={loan.currency} /></span>
      </div>
      <Progress value={loan.repaidMinor} max={loan.totalDueMinor} tone={loan.arrearsMinor > 0 ? 'destructive' : 'success'} />
    </div>
  );
}

/** The loan's terms and position. */
export function LoanFigures({ loan, showBorrower }: { loan: LoanView; showBorrower?: boolean }) {
  const c = loan.currency;
  return (
    <DetailList
      columns={4}
      items={[
        showBorrower && { label: 'Borrower', value: memberLabel(loan.borrowerName, loan.memberNumber) },
        { label: 'Product', value: loan.productName },
        { label: 'Principal', value: <MoneyText value={loan.principalMinor} currency={c} /> },
        { label: 'Interest', value: <><MoneyText value={loan.interestMinor} currency={c} /> <span className="text-xs text-muted-foreground">({formatBp(loan.interestBasisPoints)} flat)</span></> },
        { label: 'Total repayable', value: <MoneyText value={loan.totalDueMinor} currency={c} /> },
        { label: 'Term', value: `${loan.termMonths} month${loan.termMonths === 1 ? '' : 's'}` },
        { label: 'Applied', value: formatDate(loan.appliedOn) },
        loan.disbursedOn ? { label: 'Disbursed', value: formatDate(loan.disbursedOn) } : null,
        loan.maturityDate ? { label: 'Matures', value: formatDate(loan.maturityDate) } : null,
        loan.status === 'ACTIVE' ? { label: 'Outstanding', value: <MoneyText value={loan.outstandingMinor} currency={c} className="font-semibold" /> } : null,
        loan.status === 'ACTIVE' ? { label: 'Arrears', value: <MoneyText value={loan.arrearsMinor} currency={c} className={loan.arrearsMinor > 0 ? 'font-semibold text-destructive' : undefined} /> } : null,
        loan.nextDueDate ? { label: 'Next due', value: <><MoneyText value={loan.nextDueMinor} currency={c} /> on {formatDate(loan.nextDueDate)}</> } : null,
        { label: 'Purpose', value: loan.purpose },
        loan.rejectionReason ? { label: 'Rejection reason', value: loan.rejectionReason } : null,
      ]}
    />
  );
}

export function GuarantorList({ detail }: { detail: LoanDetailView }) {
  const { loan, guarantors } = detail;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        Guarantors: {loan.acceptedGuarantors} of {loan.requiredGuarantors} accepted
      </p>
      {guarantors.length === 0 ? <p className="text-sm text-muted-foreground">{loan.requiredGuarantors === 0 ? 'Not needed for this amount.' : 'None yet.'}</p> : (
        <ul className="divide-y rounded-md border">
          {guarantors.map((g) => (
            <li key={g.userId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                {memberLabel(g.name, g.memberNumber)}
                <span className="block text-xs text-muted-foreground">Asked {formatInstant(g.requestedAt)}{g.respondedAt && ` · answered ${formatInstant(g.respondedAt)}`}</span>
              </span>
              <StatusChip status={g.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ScheduleTable({ detail }: { detail: LoanDetailView }) {
  const c = detail.loan.currency;
  if (detail.schedule.length === 0) return <EmptyState title="No schedule yet" message="The repayment schedule is set when the loan is disbursed." className="py-6" />;
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>#</TableHead>
            <TableHead>Due date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {detail.schedule.map((i) => (
            <TableRow key={i.number}>
              <TableCell>{i.number}</TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(i.dueDate)}</TableCell>
              <TableCell className="text-right"><MoneyText value={i.amountMinor} currency={c} /></TableCell>
              <TableCell className="text-right"><MoneyText value={i.paidMinor} currency={c} /></TableCell>
              <TableCell><StatusChip status={i.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function RepaymentsTable({ detail, linkEntries }: { detail: LoanDetailView; linkEntries?: boolean }) {
  const c = detail.loan.currency;
  const d = detail.disbursement;
  return (
    <div className="space-y-3">
      {d && (
        <p className="text-sm text-muted-foreground">
          Disbursed {formatDate(d.disbursedOn)} by {label(d.method)}{d.reference && <> · ref <span className="font-mono">{d.reference}</span></>}
          {linkEntries && d.ledgerEntryId && <> · <EntryLink id={d.ledgerEntryId} /></>}
        </p>
      )}
      {detail.repayments.length === 0 ? <p className="text-sm text-muted-foreground">No repayments yet.</p> : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Paid on</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
                {linkEntries && <TableHead>Entry</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.repayments.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(r.paidOn)}</TableCell>
                  <TableCell className="text-right"><MoneyText value={r.amountMinor} currency={c} /></TableCell>
                  <TableCell>{label(r.method)}{r.reference && <span className="ml-1 font-mono text-xs text-muted-foreground">{r.reference}</span>}</TableCell>
                  {linkEntries && <TableCell><EntryLink id={r.ledgerEntryId} /></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** Guarantors, approvals, schedule and repayments in one block. */
export function LoanDetailBody({ detail, linkEntries }: { detail: LoanDetailView; linkEntries?: boolean }) {
  const { loan } = detail;
  const showApprovals = ['PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REPAID'].includes(loan.status) || detail.approvals.length > 0;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        <GuarantorList detail={detail} />
        {showApprovals && <ApprovalProgress approvals={detail.approvals} required={loan.requiredApprovals} />}
      </div>
      {detail.decision && (detail.decision.reason || detail.decision.cancelledAt) && (
        <div className="rounded-md border border-dashed p-3 text-sm">
          {detail.decision.cancelledAt ? <>Cancelled {formatInstant(detail.decision.cancelledAt)}</> : <>Rejected{detail.decision.rejectedAt && ` ${formatInstant(detail.decision.rejectedAt)}`}</>}
          {detail.decision.reason && <span className="text-muted-foreground"> · {detail.decision.reason}</span>}
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Repayment schedule</h3>
        <ScheduleTable detail={detail} />
      </div>
      {(detail.disbursement || detail.repayments.length > 0) && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Disbursement and repayments</h3>
          <RepaymentsTable detail={detail} linkEntries={linkEntries} />
        </div>
      )}
    </div>
  );
}

export function LoanStatusLine({ loan }: { loan: LoanView }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <StatusChip status={loan.status} />
      {loan.arrearsMinor > 0 && <Badge variant="destructive">In arrears</Badge>}
      {loan.status === 'PENDING_APPROVAL' && <span className="text-xs text-muted-foreground">Approvals {loan.approvals} of {loan.requiredApprovals}</span>}
      {loan.status === 'PENDING_GUARANTORS' && <span className="text-xs text-muted-foreground">Guarantors {loan.acceptedGuarantors} of {loan.requiredGuarantors}</span>}
    </span>
  );
}
