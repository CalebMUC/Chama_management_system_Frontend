import { describe, expect, it } from 'vitest';
import type { ChamaPermission, ExitSettlementView, ExitView } from '@/api/types';
import {
  blockerHints, blockerText, canStartExit, currentExit, exitActions, groupLines, settleErrorMessage, settlementTotals,
} from './exitRules';

const settlement = (over: Partial<ExitSettlementView> = {}): ExitSettlementView => ({
  currency: 'KES',
  refundableMinor: 5_000_00,
  forfeitedMinor: 1_000_00,
  loansMinor: 2_000_00,
  penaltiesMinor: 500_00,
  payoutMinor: 2_500_00,
  shortfallMinor: 0,
  dividendMinor: 0,
  lines: [
    { kind: 'LOAN', sourceId: 'l1', description: 'Loan: School fees', amountMinor: 2_000_00 },
    { kind: 'REFUND', sourceId: 'p1', description: 'Deposits (refunded)', amountMinor: 3_000_00 },
    { kind: 'FORFEIT', sourceId: 'p2', description: 'Share capital (not refundable: kept by the chama)', amountMinor: 1_000_00 },
    { kind: 'REFUND', sourceId: 'p3', description: 'Holiday savings (refunded)', amountMinor: 2_000_00 },
    { kind: 'PENALTY', sourceId: 'x1', description: 'Penalty: Late contribution', amountMinor: 500_00 },
  ],
  ...over,
});

const ME = 'me';
const exit = (over: Partial<ExitView> = {}): ExitView => ({
  id: 'e1',
  memberUserId: 'leaver',
  memberName: 'Jane Wanjiku',
  memberNumber: 12,
  reason: 'Relocating',
  status: 'PENDING_APPROVAL',
  settlement: settlement(),
  requestedBy: 'treasurer',
  requestedByName: 'Tom Treasurer',
  requestedAt: '2026-11-10T07:00:00Z',
  requiredApprovals: 2,
  approvals: [],
  rejectedBy: null,
  rejectedAt: null,
  rejectionReason: null,
  cancelledAt: null,
  settledOn: null,
  settledBy: null,
  paymentMethod: null,
  paymentReference: null,
  settlementEntryId: null,
  ...over,
});

const holding = (...perms: ChamaPermission[]) => (p: ChamaPermission) => perms.includes(p);
const ALL = holding('MEMBER_EXIT_REQUEST', 'MEMBER_EXIT_APPROVE', 'MEMBER_EXIT_SETTLE');

describe('groupLines', () => {
  it('groups by kind in statement order with totals, leaving out empty kinds', () => {
    const groups = groupLines(settlement().lines);
    expect(groups.map((g) => [g.title, g.lines.length, g.totalMinor])).toEqual([
      ['Refunded savings', 2, 5_000_00],
      ['Kept by the chama', 1, 1_000_00],
      ['Loans cleared from savings', 1, 2_000_00],
      ['Penalties cleared from savings', 1, 500_00],
    ]);
    expect(groupLines(settlement().lines.filter((l) => l.kind === 'REFUND')).map((g) => g.kind)).toEqual(['REFUND']);
    expect(groupLines([])).toEqual([]);
  });
});

describe('settlementTotals', () => {
  it('refundable less loans less penalties gives the payout; forfeited stands apart', () => {
    const t = settlementTotals(settlement());
    expect(t.rows).toEqual([
      { label: 'Refundable savings', amountMinor: 5_000_00 },
      { label: 'Less loans', amountMinor: -2_000_00 },
      { label: 'Less penalties', amountMinor: -500_00 },
      { label: 'Payout to the member', amountMinor: 2_500_00, emphasis: true },
    ]);
    expect(t.rows.reduce((s, r) => (r.emphasis ? s : s + r.amountMinor), 0)).toBe(t.rows[3].amountMinor);
    expect(t.forfeitedMinor).toBe(1_000_00);
  });

  it('omits deductions that are zero and passes the shortfall through', () => {
    const t = settlementTotals(settlement({ loansMinor: 0, penaltiesMinor: 0, payoutMinor: 5_000_00, shortfallMinor: 0 }));
    expect(t.rows.map((r) => r.label)).toEqual(['Refundable savings', 'Payout to the member']);
    expect(settlementTotals(settlement({ shortfallMinor: 700_00 })).shortfallMinor).toBe(700_00);
  });
});

describe('exitActions', () => {
  it('lets a checker approve and reject a pending exit, but not settle or cancel it', () => {
    const a = exitActions(exit(), ME, ALL);
    expect(a.approve).toEqual({ show: true, blocked: null });
    expect(a.reject).toEqual({ show: true, blocked: null });
    expect(a.settle.show).toBe(false);
    expect(a.cancel).toBe(false);
  });

  it('nobody handles their own exit', () => {
    const a = exitActions(exit({ memberUserId: ME, status: 'APPROVED' }), ME, ALL);
    expect(a.reject.blocked).toMatch(/your own exit/);
    expect(a.settle).toEqual({ show: true, blocked: expect.stringMatching(/your own exit/) });
    expect(a.cancel).toBe(false);
    expect(exitActions(exit({ memberUserId: ME }), ME, ALL).approve.blocked).toMatch(/your own exit/);
  });

  it('whoever started it cannot approve or reject it, and only they can cancel it', () => {
    const mine = exitActions(exit({ requestedBy: ME }), ME, ALL);
    expect(mine.approve.blocked).toMatch(/You started this exit/);
    expect(mine.reject.blocked).toMatch(/You started this exit/);
    expect(mine.cancel).toBe(true);
    expect(exitActions(exit(), ME, ALL).cancel).toBe(false);
    // Cancelling still needs MEMBER_EXIT_REQUEST.
    expect(exitActions(exit({ requestedBy: ME }), ME, holding('MEMBER_EXIT_APPROVE')).cancel).toBe(false);
  });

  it('an official who already approved cannot approve again', () => {
    const e = exit({ approvals: [{ approverUserId: ME, name: 'Me', note: null, approvedAt: '2026-11-11T08:00:00Z' }] });
    expect(exitActions(e, ME, ALL).approve.blocked).toMatch(/already approved/);
    expect(exitActions(e, 'someone-else', ALL).approve.blocked).toBeNull();
  });

  it('pays out only once APPROVED, and only with MEMBER_EXIT_SETTLE', () => {
    expect(exitActions(exit({ status: 'APPROVED' }), ME, ALL).settle).toEqual({ show: true, blocked: null });
    expect(exitActions(exit({ status: 'APPROVED' }), ME, holding('MEMBER_EXIT_APPROVE')).settle.show).toBe(false);
    for (const status of ['PENDING_APPROVAL', 'SETTLED', 'REJECTED', 'CANCELLED'] as const) {
      expect(exitActions(exit({ status }), ME, ALL).settle.show).toBe(false);
    }
  });

  it('approving is only while pending; rejecting and cancelling until payout', () => {
    const approved = exitActions(exit({ status: 'APPROVED', requestedBy: ME }), ME, ALL);
    expect(approved.approve.show).toBe(false);
    expect(approved.reject.show).toBe(true);
    expect(approved.cancel).toBe(true);
    for (const status of ['SETTLED', 'REJECTED', 'CANCELLED'] as const) {
      const a = exitActions(exit({ status, requestedBy: ME }), ME, ALL);
      expect([a.approve.show, a.reject.show, a.cancel]).toEqual([false, false, false]);
    }
  });

  it('shows nothing without the permissions', () => {
    const a = exitActions(exit({ status: 'APPROVED', requestedBy: ME }), ME, holding());
    expect([a.approve.show, a.reject.show, a.cancel, a.settle.show]).toEqual([false, false, false, false]);
  });
});

describe('canStartExit', () => {
  it('only for active or suspended members, never yourself, with MEMBER_EXIT_REQUEST', () => {
    expect(canStartExit({ userId: 'x', status: 'ACTIVE' }, ME, ALL)).toBe(true);
    expect(canStartExit({ userId: 'x', status: 'SUSPENDED' }, ME, ALL)).toBe(true);
    expect(canStartExit({ userId: 'x', status: 'EXITED' }, ME, ALL)).toBe(false);
    expect(canStartExit({ userId: 'x', status: 'PENDING_APPROVAL' }, ME, ALL)).toBe(false);
    expect(canStartExit({ userId: ME, status: 'ACTIVE' }, ME, ALL)).toBe(false);
    expect(canStartExit({ userId: 'x', status: 'ACTIVE' }, ME, holding('MEMBER_EXIT_APPROVE'))).toBe(false);
  });
});

describe('currentExit', () => {
  it('picks the newest exit in progress or settled, skipping rejected and cancelled ones', () => {
    const list = [exit({ id: 'a', status: 'CANCELLED' }), exit({ id: 'b', status: 'APPROVED' }), exit({ id: 'c', status: 'REJECTED' })];
    expect(currentExit(list)?.id).toBe('b');
    expect(currentExit([exit({ status: 'REJECTED' })])).toBeNull();
    expect(currentExit([])).toBeNull();
  });
});

describe('blockers', () => {
  const guarantee = 'The member guarantees Ann Achieng\'s loan "Shop stock" (KES 20,000.00 outstanding): transfer the guarantee to another member first';
  const application = 'The member\'s loan application "Roofing" is still in progress: it must be cancelled or rejected first';
  const shortfall = 'The member owes KES 1,200.00 more than their refundable savings: they must pay it before leaving';

  it('reads plain strings or { message } objects', () => {
    expect(blockerText(guarantee)).toBe(guarantee);
    expect(blockerText({ type: 'SHORTFALL', message: shortfall })).toBe(shortfall);
  });

  it('offers only the hints that apply', () => {
    expect(blockerHints([guarantee])).toEqual(['guarantee']);
    expect(blockerHints([application, shortfall])).toEqual(['application', 'shortfall']);
    expect(blockerHints(["The chama's only active chairperson cannot leave"])).toEqual([]);
  });
});

describe('settleErrorMessage', () => {
  it('explains a settlement that changed since approval', () => {
    expect(settleErrorMessage('EXIT_SETTLEMENT_CHANGED', 'x')).toMatch(/Reject or cancel this exit, then start a new one/);
  });
  it('keeps the server message for codes it does not explain', () => {
    expect(settleErrorMessage('EXIT_WRONG_STATUS', 'Already settled')).toBe('Already settled');
    expect(settleErrorMessage('EXIT_BLOCKED', 'The member guarantees a loan')).toMatch(/^The member guarantees a loan\. Something now stops/);
  });
});
