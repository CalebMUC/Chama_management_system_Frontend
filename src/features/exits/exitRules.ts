import type { BadgeVariant } from '@/components/ui/primitives';
import type { ChamaPermission, ExitLineKind, ExitLineView, ExitSettlementView, ExitStatus, ExitView } from '@/api/types';

// Pure rules for member exits (API_REFERENCE §3a): how a settlement reads, and which actions the signed-in official sees.

export const EXIT_STATUSES: ExitStatus[] = ['PENDING_APPROVAL', 'APPROVED', 'SETTLED', 'REJECTED', 'CANCELLED'];

/** Still before payout: it can be approved, rejected or cancelled. */
export const isExitOpen = (s: ExitStatus) => s === 'PENDING_APPROVAL' || s === 'APPROVED';

/** Exit status colours. APPROVED is blue here (waiting for payout), unlike the green "done" APPROVED elsewhere. */
export const EXIT_STATUS_VARIANT: Record<ExitStatus, BadgeVariant> = {
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  SETTLED: 'success',
  REJECTED: 'destructive',
  CANCELLED: 'secondary',
};

export const LINE_GROUPS: { kind: ExitLineKind; title: string }[] = [
  { kind: 'REFUND', title: 'Refunded savings' },
  { kind: 'FORFEIT', title: 'Kept by the chama' },
  { kind: 'LOAN', title: 'Loans cleared from savings' },
  { kind: 'PENALTY', title: 'Penalties cleared from savings' },
];

export interface LineGroup {
  kind: ExitLineKind;
  title: string;
  lines: ExitLineView[];
  totalMinor: number;
}

/** The statement's lines by kind, in statement order. Kinds with no lines are left out. */
export function groupLines(lines: ExitLineView[]): LineGroup[] {
  return LINE_GROUPS.map(({ kind, title }) => {
    const of = lines.filter((l) => l.kind === kind);
    return { kind, title, lines: of, totalMinor: of.reduce((sum, l) => sum + l.amountMinor, 0) };
  }).filter((g) => g.lines.length > 0);
}

export interface TotalRow {
  label: string;
  /** Signed: deductions are negative. */
  amountMinor: number;
  emphasis?: boolean;
}

/**
 * The settlement's arithmetic: refundable, less loans, less penalties, gives the payout. Forfeited savings are kept by the chama
 * and are not part of the sum. The figures are the server's; `payoutMinor` is shown as sent, not recomputed.
 */
export function settlementTotals(s: ExitSettlementView): { rows: TotalRow[]; forfeitedMinor: number; shortfallMinor: number } {
  const rows: TotalRow[] = [{ label: 'Refundable savings', amountMinor: s.refundableMinor }];
  if (s.loansMinor > 0) rows.push({ label: 'Less loans', amountMinor: -s.loansMinor });
  if (s.penaltiesMinor > 0) rows.push({ label: 'Less penalties', amountMinor: -s.penaltiesMinor });
  rows.push({ label: 'Payout to the member', amountMinor: s.payoutMinor, emphasis: true });
  return { rows, forfeitedMinor: s.forfeitedMinor, shortfallMinor: s.shortfallMinor };
}

/** An action and, if a rule stops this user, why (shown as a disabled button with the reason). */
export interface GatedAction {
  show: boolean;
  blocked: string | null;
}

export interface ExitActions {
  approve: GatedAction;
  reject: GatedAction;
  /** Only whoever started the exit, before payout. */
  cancel: boolean;
  settle: GatedAction;
}

/**
 * Which actions the signed-in official sees on an exit (README §8.1 maker-checker):
 *  - nobody handles their own exit;
 *  - whoever started it can't approve or reject it, and only they can cancel it;
 *  - an official who already approved can't approve again;
 *  - payout only once APPROVED.
 */
export function exitActions(e: ExitView, me: string | null, can: (p: ChamaPermission) => boolean): ExitActions {
  const own = !!me && e.memberUserId === me;
  const requester = !!me && e.requestedBy === me;
  const open = isExitOpen(e.status);
  const ownExit = own ? 'This is your own exit; other officials handle it.' : null;
  const already = !!me && e.approvals.some((a) => a.approverUserId === me);

  return {
    approve: {
      show: e.status === 'PENDING_APPROVAL' && can('MEMBER_EXIT_APPROVE'),
      blocked: ownExit ?? (requester ? 'You started this exit, so someone else must approve it.' : already ? 'You have already approved this exit.' : null),
    },
    reject: {
      show: open && can('MEMBER_EXIT_APPROVE'),
      blocked: ownExit ?? (requester ? 'You started this exit, so someone else must reject it. You can cancel it instead.' : null),
    },
    cancel: open && requester && !own && can('MEMBER_EXIT_REQUEST'),
    settle: {
      show: e.status === 'APPROVED' && can('MEMBER_EXIT_SETTLE'),
      blocked: ownExit,
    },
  };
}

/** May this official start an exit for this member? Only ACTIVE or SUSPENDED members, never themselves. */
export function canStartExit(member: { userId: string; status: string }, me: string | null, can: (p: ChamaPermission) => boolean): boolean {
  return member.userId !== me && (member.status === 'ACTIVE' || member.status === 'SUSPENDED') && can('MEMBER_EXIT_REQUEST');
}

/** The exit to show a member on their home page: the newest one in progress or settled. */
export function currentExit(exits: ExitView[]): ExitView | null {
  return exits.find((e) => e.status === 'PENDING_APPROVAL' || e.status === 'APPROVED' || e.status === 'SETTLED') ?? null;
}

/**
 * A blocker's sentence. The API sends plain strings; a later backend may send `{ type, message, … }`, so read either.
 */
export function blockerText(b: unknown): string {
  if (typeof b === 'string') return b;
  if (b && typeof b === 'object' && typeof (b as { message?: unknown }).message === 'string') return (b as { message: string }).message;
  return String(b);
}

export type BlockerHint = 'guarantee' | 'application' | 'shortfall';

/** Which "what to do" notes apply to these blockers (guarantee to transfer, application to close, shortfall to pay). */
export function blockerHints(blockers: unknown[]): BlockerHint[] {
  const texts = blockers.map(blockerText);
  const out: BlockerHint[] = [];
  if (texts.some((t) => /guarant/i.test(t))) out.push('guarantee');
  if (texts.some((t) => /loan application/i.test(t))) out.push('application');
  if (texts.some((t) => /shortfall|more than their refundable savings/i.test(t))) out.push('shortfall');
  return out;
}

/**
 * A payout failure in plain words. Codes not listed keep the server's message. The server's message is kept where it carries
 * detail (the blockers, the shortfall in cash).
 */
export function settleErrorMessage(code: string, serverMessage: string): string {
  switch (code) {
    case 'EXIT_SETTLEMENT_CHANGED':
      return "The member's savings, loans or penalties have changed since this exit was approved, so it can't be paid out as approved. Reject or cancel this exit, then start a new one to work out a fresh settlement.";
    case 'EXIT_INSUFFICIENT_FUNDS':
      return `${serverMessage} The chama doesn't hold enough in that account to pay this out. Check the cash balances, or pay from another account.`;
    case 'EXIT_DUPLICATE_REFERENCE':
      return 'That reference has already been used for another payment. Check the M-Pesa code or bank slip number.';
    case 'EXIT_BLOCKED':
      return `${serverMessage.replace(/[.\s]+$/, '')}. Something now stops this member leaving: clear it first, or reject or cancel this exit.`;
    case 'MEMBER_LAST_CHAIRPERSON':
      return "This member is the chama's only active chairperson. Make another member chairperson first (Change roles on their page), then pay out.";
    default:
      return serverMessage;
  }
}
