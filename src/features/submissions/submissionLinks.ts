import type { SubmissionKind, SubmissionView } from '@/api/types';

export const REPORT_PAYMENT_PATH = '/me/payments/new';
export const MY_REPORTS_PATH = '/me/payments';
export const REVIEW_QUEUE_PATH = '/payment-submissions';

/** What the report form can be prefilled with, through the query string. */
export interface ReportPrefill {
  kind?: SubmissionKind;
  targetId?: string;
  amountMinor?: number;
  method?: string;
  reference?: string;
  paidOn?: string;
  notes?: string;
}

/** A link to the report form, prefilled: "I've paid this" on a penalty, "Report a repayment" on a loan, "Report again". */
export function reportPaymentHref(p: ReportPrefill = {}): string {
  const sp = new URLSearchParams();
  if (p.kind) sp.set('kind', p.kind);
  if (p.targetId) sp.set('targetId', p.targetId);
  if (p.amountMinor) sp.set('amount', String(p.amountMinor));
  if (p.method) sp.set('method', p.method);
  if (p.reference) sp.set('reference', p.reference);
  if (p.paidOn) sp.set('paidOn', p.paidOn);
  if (p.notes) sp.set('notes', p.notes);
  const qs = sp.toString();
  return qs ? `${REPORT_PAYMENT_PATH}?${qs}` : REPORT_PAYMENT_PATH;
}

/** "Report again" after a rejection: the same payment, to correct and resend. */
export const reportAgainHref = (s: SubmissionView) =>
  reportPaymentHref({ kind: s.kind, targetId: s.targetId ?? undefined, amountMinor: s.amountMinor, method: s.method, reference: s.reference ?? undefined, paidOn: s.paidOn, notes: s.notes ?? undefined });

export function readPrefill(params: URLSearchParams): ReportPrefill {
  const kind = params.get('kind');
  const amount = Number(params.get('amount'));
  return {
    kind: kind === 'CONTRIBUTION' || kind === 'PENALTY_PAYMENT' || kind === 'LOAN_REPAYMENT' ? kind : undefined,
    targetId: params.get('targetId') ?? undefined,
    amountMinor: Number.isInteger(amount) && amount > 0 ? amount : undefined,
    method: params.get('method') ?? undefined,
    reference: params.get('reference') ?? undefined,
    paidOn: params.get('paidOn') ?? undefined,
    notes: params.get('notes') ?? undefined,
  };
}

/** "Contribution", "Penalty · Late contribution Sep 2026", "Loan repayment · Loan: School fees". */
export function whatFor(s: Pick<SubmissionView, 'kind' | 'targetDescription'>): string {
  const kind = { CONTRIBUTION: 'Contribution', PENALTY_PAYMENT: 'Penalty', LOAN_REPAYMENT: 'Loan repayment' }[s.kind];
  return s.targetDescription ? `${kind} · ${s.targetDescription}` : kind;
}

/** Member-facing wording: nothing is "paid" until an official confirms it. */
export const SUBMISSION_STATUS_TEXT: Record<SubmissionView['status'], string> = {
  PENDING: 'Awaiting confirmation',
  APPROVED: 'Confirmed',
  REJECTED: 'Rejected',
  CANCELLED: 'Withdrawn',
};
