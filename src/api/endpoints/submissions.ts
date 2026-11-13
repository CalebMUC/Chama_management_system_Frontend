import { api } from '../client';
import type { SubmissionKind, SubmissionReviewCounts, SubmissionStatus, SubmissionView, SubmitPaymentRequest, UUID } from '../types';

export interface SubmissionListParams {
  status?: SubmissionStatus;
  kind?: SubmissionKind;
  memberUserId?: UUID;
  page?: number;
  size?: number;
}

/**
 * §10 Payment submissions: a member reports a payment they made; an official with the matching record permission confirms it,
 * which records the real contribution, penalty payment or loan repayment. A report alone moves no money.
 */
export const submissionsApi = {
  // Member
  submit: (body: SubmitPaymentRequest) => api.post<SubmissionView>('/payment-submissions', body),
  /** Pending first, then newest first. */
  mine: (params: { status?: SubmissionStatus; page?: number; size?: number }) => api.getPaged<SubmissionView>('/payment-submissions/me', params),
  cancel: (id: string) => api.post<SubmissionView>(`/payment-submissions/${id}/cancel`),
  // Reviewers (CONTRIBUTION_RECORD, PENALTY_RECORD or LOAN_REPAYMENT_RECORD)
  /** Only the kinds the caller may review. Pending first (oldest first), then the rest newest first. */
  list: (params: SubmissionListParams) => api.getPaged<SubmissionView>('/payment-submissions', params),
  reviewableKinds: () => api.get<SubmissionKind[]>('/payment-submissions/reviewable-kinds'),
  /** Pending reports the caller can act on: their reviewable kinds, not their own reports. Needs no REPORT_VIEW_ALL. */
  pendingCount: () => api.get<SubmissionReviewCounts>('/payment-submissions/pending-count'),
  get: (id: string) => api.get<SubmissionView>(`/payment-submissions/${id}`),
  approve: (id: string, note?: string) => api.post<SubmissionView>(`/payment-submissions/${id}/approve`, note ? { note } : {}),
  reject: (id: string, reason: string) => api.post<SubmissionView>(`/payment-submissions/${id}/reject`, { reason }),
};
