import { api } from '../client';
import type {
  ApplyLoanRequest, DisburseRequest, EligibilityView, GuarantorCandidate, GuaranteeView, LoanDetailView, LoanListParams, LoanProductRequest,
  LoanProductView, LoanView, MyLoansView, RepaymentRequest,
} from '../types';

/** §8 Loan products (feature LOANS). */
export const loanProductsApi = {
  list: () => api.get<LoanProductView[]>('/loan-products'),
  get: (id: string) => api.get<LoanProductView>(`/loan-products/${id}`),
  create: (body: LoanProductRequest) => api.post<LoanProductView>('/loan-products', body),
  update: (id: string, body: LoanProductRequest) => api.put<LoanProductView>(`/loan-products/${id}`, body),
  activate: (id: string) => api.post<LoanProductView>(`/loan-products/${id}/activate`),
  deactivate: (id: string) => api.post<LoanProductView>(`/loan-products/${id}/deactivate`),
};

/** §9 Loans. */
export const loansApi = {
  // Member
  eligibility: (productId?: string) => api.get<EligibilityView>('/loans/eligibility', { productId }),
  apply: (body: ApplyLoanRequest) => api.post<LoanDetailView>('/loans', body),
  mine: () => api.get<MyLoansView>('/loans/me'),
  /** Every active member except the caller (LOAN_APPLY). Plain members can't call GET /members, so pickers use this. */
  guarantorCandidates: () => api.get<GuarantorCandidate[]>('/loans/guarantor-candidates'),
  guarantees: () => api.get<GuaranteeView[]>('/loans/guarantees'),
  respondGuarantee: (id: string, accept: boolean) => api.post<LoanDetailView>(`/loans/${id}/guarantee`, { accept }),
  addGuarantor: (id: string, guarantorUserId: string) => api.post<LoanDetailView>(`/loans/${id}/guarantors`, { guarantorUserId }),
  cancel: (id: string) => api.post<LoanDetailView>(`/loans/${id}/cancel`),
  // Officials
  list: (params: LoanListParams) => api.getPaged<LoanView>('/loans', params),
  get: (id: string) => api.get<LoanDetailView>(`/loans/${id}`),
  approve: (id: string, note?: string) => api.post<LoanDetailView>(`/loans/${id}/approve`, note ? { note } : {}),
  reject: (id: string, reason: string) => api.post<LoanDetailView>(`/loans/${id}/reject`, { reason }),
  disburse: (id: string, body: DisburseRequest) => api.post<LoanDetailView>(`/loans/${id}/disburse`, body),
  repay: (id: string, body: RepaymentRequest) => api.post<LoanDetailView>(`/loans/${id}/repayments`, body),
};
