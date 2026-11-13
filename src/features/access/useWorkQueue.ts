'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/endpoints/books';
import { submissionsApi } from '@/api/endpoints/submissions';
import { REVIEW_PERMISSIONS, type BadgeKey } from '@/config/navigation';
import { useCan, useHasFeature } from '@/hooks/useSessionInfo';
import { licenceUsable, useSession } from '@/stores/session';

const POLL = 3 * 60_000;

/**
 * Reported payments this user can confirm: GET /payment-submissions/pending-count (their reviewable kinds, not their own
 * reports; works without REPORT_VIEW_ALL). Under the `paymentSubmissions` key, so confirming or rejecting refreshes it.
 * GET /dashboard `pending.*AwaitingReview` stays the chama-wide count, for the overview's "Needs attention" panel only.
 */
export function usePaymentsToConfirm(enabled: boolean) {
  const can = useCan();
  const q = useQuery({
    queryKey: ['paymentSubmissions', 'pendingCount'],
    queryFn: submissionsApi.pendingCount,
    enabled: enabled && can(REVIEW_PERMISSIONS),
    refetchInterval: POLL,
    refetchOnWindowFocus: true,
  });
  return { count: q.data?.total ?? 0, isLoading: q.isLoading };
}

/**
 * Work-queue counts for the nav badges (README §6.2). There is no notifications feed or push: derive to-dos from the dashboards
 * and poll every few minutes, and on window focus.
 */
export function useWorkQueue(): Record<BadgeKey, number> {
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
  return {
    applications: can('MEMBER_APPROVE') ? p?.membershipApplications ?? 0 : 0,
    loans: (can('LOAN_APPROVE') ? p?.loansAwaitingApproval ?? 0 : 0) + (can('LOAN_DISBURSE') ? p?.loansAwaitingDisbursement ?? 0 : 0),
    expenses: (can('EXPENSE_APPROVE') ? p?.expensesAwaitingApproval ?? 0 : 0) + (can('EXPENSE_CREATE') ? p?.expensesAwaitingPayment ?? 0 : 0),
    investments: can('INVESTMENT_APPROVE') ? p?.investmentsAwaitingApproval ?? 0 : 0,
    guarantees: mine.data?.loans?.guaranteeRequests ?? 0,
    payments: payments.count,
  };
}
