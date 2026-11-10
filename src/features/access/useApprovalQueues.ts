'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/endpoints/books';
import { REVIEW_PERMISSIONS } from '@/config/navigation';
import { useCan, useHasFeature } from '@/hooks/useSessionInfo';
import { usePaymentsToConfirm } from './useWorkQueue';
import { licenceUsable, useSession } from '@/stores/session';

export interface ApprovalQueue {
  key: string;
  label: string;
  count: number;
  /** The pre-filtered list (the same links the chama overview uses). */
  href: string;
}

const POLL = 3 * 60_000;

/**
 * The approvals inbox: one row per work queue this user can act on. Reads the same dashboard queries (same keys, same polling)
 * and applies the same permission rules as useWorkQueue, so the inbox total always equals the sum of the sidebar badges.
 */
export function useApprovalQueues(): { queues: ApprovalQueue[]; total: number; loading: boolean } {
  const can = useCan();
  const hasFeature = useHasFeature();
  const usable = useSession((s) => s.status === 'authenticated' && !s.isPlatformAdmin && s.membership?.status === 'ACTIVE' && licenceUsable(s.licence));
  const official = useQuery({
    queryKey: ['dashboard', 'chama'],
    queryFn: dashboardApi.chama,
    enabled: usable && can('REPORT_VIEW_ALL'),
    refetchInterval: POLL,
    refetchOnWindowFocus: true,
  });
  const mine = useQuery({
    queryKey: ['dashboard', 'me'],
    queryFn: dashboardApi.mine,
    enabled: usable && hasFeature('LOANS'),
    refetchInterval: POLL,
    refetchOnWindowFocus: true,
  });
  const payments = usePaymentsToConfirm(usable);
  const p = official.data?.pending;
  const rows: (ApprovalQueue | false)[] = [
    can('MEMBER_APPROVE') && { key: 'applications', label: 'Membership applications', count: p?.membershipApplications ?? 0, href: '/members?status=PENDING_APPROVAL' },
    can('LOAN_APPROVE') && { key: 'loan-approval', label: 'Loans awaiting approval', count: p?.loansAwaitingApproval ?? 0, href: '/loans?status=PENDING_APPROVAL' },
    can('LOAN_DISBURSE') && { key: 'loan-disbursement', label: 'Loans awaiting disbursement', count: p?.loansAwaitingDisbursement ?? 0, href: '/loans?status=APPROVED' },
    can('EXPENSE_APPROVE') && { key: 'expense-approval', label: 'Expenses awaiting approval', count: p?.expensesAwaitingApproval ?? 0, href: '/expenses?status=PENDING_APPROVAL' },
    can('EXPENSE_CREATE') && { key: 'expense-payment', label: 'Expenses awaiting payment', count: p?.expensesAwaitingPayment ?? 0, href: '/expenses?status=APPROVED' },
    can('INVESTMENT_APPROVE') && { key: 'investments', label: 'Investments awaiting approval', count: p?.investmentsAwaitingApproval ?? 0, href: '/investments?status=PROPOSED' },
    can(REVIEW_PERMISSIONS) && { key: 'payments', label: 'Reported payments to confirm', count: payments.count, href: '/payment-submissions?status=PENDING' },
    hasFeature('LOANS') && { key: 'guarantees', label: 'Guarantee requests for you', count: mine.data?.loans?.guaranteeRequests ?? 0, href: '/me/guarantees' },
  ];
  // Unlicensed queues come back null: leave them out rather than showing a 0.
  const unlicensed = (key: string) =>
    (key.startsWith('loan') && p?.loansAwaitingApproval === null) || (key.startsWith('expense') && p?.expensesAwaitingApproval === null) || (key === 'investments' && p?.investmentsAwaitingApproval === null);
  const queues = rows.filter((r): r is ApprovalQueue => !!r && !unlicensed(r.key));
  return { queues, total: queues.reduce((s, q) => s + q.count, 0), loading: official.isLoading || mine.isLoading || payments.isLoading };
}
