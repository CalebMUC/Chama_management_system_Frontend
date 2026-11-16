import { describe, expect, it } from 'vitest';
import type { GuarantorView, LoanDetailView, LoanStatus } from '@/api/types';
import { canTransferGuarantee, pendingReplacement, transferExclusions, transferNote } from './guaranteeTransfer';

const g = (userId: string, status: GuarantorView['status'], replacesUserId: string | null = null): GuarantorView => ({
  userId, name: userId.toUpperCase(), memberNumber: null, status, requestedAt: '2026-11-01T08:00:00Z', respondedAt: null, replacesUserId,
});

const detail = (status: LoanStatus, guarantors: GuarantorView[]): LoanDetailView =>
  ({ loan: { id: 'loan', status, borrowerUserId: 'borrower' }, guarantors, approvals: [], disbursement: null, decision: null, schedule: [], repayments: [] }) as unknown as LoanDetailView;

describe('canTransferGuarantee', () => {
  const ann = g('ann', 'ACCEPTED');
  const d = detail('ACTIVE', [ann, g('bob', 'ACCEPTED')]);

  it('the borrower, the guarantor or a LOAN_APPROVE official may transfer', () => {
    expect(canTransferGuarantee(d, ann, 'borrower', false)).toBe(true);
    expect(canTransferGuarantee(d, ann, 'ann', false)).toBe(true);
    expect(canTransferGuarantee(d, ann, 'official', true)).toBe(true);
    expect(canTransferGuarantee(d, ann, 'bob', false)).toBe(false);
    expect(canTransferGuarantee(d, ann, null, true)).toBe(false);
  });

  it('only an ACCEPTED guarantor', () => {
    for (const status of ['REQUESTED', 'DECLINED', 'WITHDRAWN', 'RELEASED'] as const) {
      const x = g('ann', status);
      expect(canTransferGuarantee(detail('ACTIVE', [x]), x, 'borrower', true)).toBe(false);
    }
  });

  it('only on a loan that is not repaid, rejected or cancelled', () => {
    for (const status of ['PENDING_GUARANTORS', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE'] as const) {
      expect(canTransferGuarantee(detail(status, [ann]), ann, 'borrower', false)).toBe(true);
    }
    for (const status of ['REPAID', 'REJECTED', 'CANCELLED'] as const) {
      expect(canTransferGuarantee(detail(status, [ann]), ann, 'borrower', true)).toBe(false);
    }
  });

  it('one pending replacement at a time', () => {
    const pending = detail('ACTIVE', [ann, g('cid', 'REQUESTED', 'ann')]);
    expect(pendingReplacement(pending.guarantors, 'ann')?.userId).toBe('cid');
    expect(canTransferGuarantee(pending, ann, 'borrower', true)).toBe(false);
    // A declined takeover no longer blocks a new one.
    const declined = detail('ACTIVE', [ann, g('cid', 'DECLINED', 'ann')]);
    expect(canTransferGuarantee(declined, ann, 'borrower', true)).toBe(true);
  });
});

describe('transferExclusions', () => {
  it('excludes the borrower and anyone guaranteeing or asked, not those who left', () => {
    const d = detail('ACTIVE', [g('ann', 'ACCEPTED'), g('cid', 'REQUESTED', 'ann'), g('dan', 'DECLINED'), g('eve', 'RELEASED')]);
    expect(transferExclusions(d)).toEqual(['borrower', 'ann', 'cid']);
  });
});

describe('transferNote', () => {
  const nameOf = (x: GuarantorView) => x.name ?? x.userId;
  const list = [g('ann', 'ACCEPTED'), g('cid', 'REQUESTED', 'ann'), g('eve', 'RELEASED'), g('fay', 'ACCEPTED', 'eve')];

  it('describes both sides of a transfer', () => {
    expect(transferNote(list[1], list, nameOf)).toBe('Taking over from ANN — awaiting acceptance');
    expect(transferNote(list[0], list, nameOf)).toBe('CID has been asked to take over this guarantee');
    expect(transferNote(list[3], list, nameOf)).toBe('Took over from EVE');
    expect(transferNote(list[2], list, nameOf)).toBeNull();
    expect(transferNote(g('zed', 'ACCEPTED'), list, nameOf)).toBeNull();
  });
});
