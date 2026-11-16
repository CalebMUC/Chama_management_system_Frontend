import type { GuarantorView, LoanDetailView, LoanStatus } from '@/api/types';

// Guarantee transfers (POST /loans/{loanId}/guarantors/{guarantorUserId}/replace): pure rules for when to offer one.

/** A guarantee can move while the loan is open: not repaid, rejected or cancelled. */
export const isLoanOpen = (s: LoanStatus) => s !== 'REPAID' && s !== 'REJECTED' && s !== 'CANCELLED';

/** The REQUESTED row asking someone to take over this guarantor's guarantee, if any (one at a time). */
export const pendingReplacement = (guarantors: GuarantorView[], userId: string) =>
  guarantors.find((g) => g.status === 'REQUESTED' && g.replacesUserId === userId) ?? null;

/**
 * May the signed-in user transfer this guarantor's guarantee? The borrower, the guarantor themselves, or an official with
 * LOAN_APPROVE; only an ACCEPTED guarantor of an open loan with no replacement already pending.
 */
export function canTransferGuarantee(detail: LoanDetailView, g: GuarantorView, me: string | null, canApprove: boolean): boolean {
  if (!me) return false;
  if (g.status !== 'ACCEPTED' || !isLoanOpen(detail.loan.status)) return false;
  if (pendingReplacement(detail.guarantors, g.userId)) return false;
  return detail.loan.borrowerUserId === me || g.userId === me || canApprove;
}

/** Who can't take over: the borrower and anyone already guaranteeing or asked to. */
export function transferExclusions(detail: LoanDetailView): string[] {
  return [
    detail.loan.borrowerUserId,
    ...detail.guarantors.filter((g) => g.status === 'ACCEPTED' || g.status === 'REQUESTED').map((g) => g.userId),
  ];
}

/** A line under a guarantor's name about a transfer: who they are taking over from, or who is taking over from them. */
export function transferNote(g: GuarantorView, guarantors: GuarantorView[], nameOf: (g: GuarantorView) => string): string | null {
  const byId = (id: string) => guarantors.find((x) => x.userId === id);
  if (g.replacesUserId) {
    const from = byId(g.replacesUserId);
    const who = from ? nameOf(from) : 'another guarantor';
    if (g.status === 'REQUESTED') return `Taking over from ${who} — awaiting acceptance`;
    if (g.status === 'ACCEPTED') return `Took over from ${who}`;
    return null;
  }
  if (g.status === 'ACCEPTED') {
    const incoming = pendingReplacement(guarantors, g.userId);
    if (incoming) return `${nameOf(incoming)} has been asked to take over this guarantee`;
  }
  return null;
}
